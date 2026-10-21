/**
 * Shared AI request handling (OpenRouter), decoupled from any HTTP framework.
 *
 * The Cloudflare Worker (worker/index.ts) and server.ts (the Express server for
 * local dev / Node hosts) call these same functions,
 * so the two entry points can never drift apart on how a request is
 * actually handled — only the thin req/res adapter at each entry point differs.
 */
import { EXACT_SYSTEM_INSTRUCTION, OPENROUTER_MODEL, OPENROUTER_MODELS, buildSystemInstruction } from '../constants.js';
import { buildRefineInstruction, composePrompt, parseBrief, refineAddsContent, resolveOutputLanguage } from '../prompting.js';
import { checkBrief, repairRequest } from '../briefCheck.js';
import { refineLocalPromptText } from '../services/localRefiner.js';
import { generateLocalStructuredPrompt } from '../services/localEngine.js';
import { DomainType, DepthType, OutputLanguage } from '../types.js';

export interface HandlerResult {
  status: number;
  body: unknown;
  /** For the admin dashboard's log (src/server/admin.ts); never sent to the client. */
  meta?: CallMeta;
}

/** Why a call failed, as the dashboard groups errors. */
export type ErrorType = 'busy' | 'down' | 'brief' | 'long' | 'other';

export interface CallMeta {
  /** What OpenRouter charged for the call's model requests, in US dollars. */
  cost: number;
  error?: ErrorType;
  /** OpenRouter's message or the reason the request was refused. */
  detail?: string;
}

/** The dashboard's settings that change how a call is made (src/server/settings.ts). */
export interface CallOptions {
  /** The models to try, in order. */
  models?: string[];
  /** The longest request text accepted. */
  maxChars?: number;
  /** Whether the model may ask clarifying questions first. */
  clarify?: boolean;
}

function errorType(message: string): ErrorType {
  if (/OpenRouter 429/.test(message)) return 'busy';
  if (/OpenRouter (40[0-4]|5\d\d)|unavailable|fetch failed|network/i.test(message)) return 'down';
  if (/brief|empty response|JSON/i.test(message)) return 'brief';
  return 'other';
}

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * OPENROUTER_API_KEY from process.env on Node hosts. The Cloudflare Worker has no
 * process.env and passes the key from its own env binding instead.
 */
function nodeServerKey(): string | undefined {
  return typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY : undefined;
}

/** The key the user supplied in the x-api-key header, or the server key. */
function resolveApiKey(userApiKey: string | undefined, serverKey: string | undefined): string | undefined {
  return (userApiKey || '').trim() || (serverKey || '').trim() || undefined;
}

/** A model that is retired or has no provider right now: try the next model in the list. */
function isModelUnavailable(status: number, message: string): boolean {
  return status === 404 || status >= 500 || (status === 400 && /model|endpoint/i.test(message));
}

/**
 * Sends one chat completion to OpenRouter and returns the generated text. Retries a model once
 * on 429/5xx, moves to the next model in `models` when one is unavailable, and throws anything
 * else for the caller's local fallback. What OpenRouter charged is added to `meta.cost`.
 */
async function generateWithOpenRouter(
  apiKey: string,
  params: {
    systemInstruction: string;
    userText: string;
    temperature: number;
    /** Later turns of the same conversation (the model's earlier answer and a follow-up). */
    followUp?: { role: 'assistant' | 'user'; content: string }[];
  },
  models: string[],
  meta: CallMeta
): Promise<{ text: string; modelUsed: string }> {
  let lastError: Error | null = null;

  for (const model of models) {
    const body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: params.systemInstruction },
        { role: 'user', content: params.userText },
        ...(params.followUp || []),
      ],
      temperature: params.temperature,
      usage: { include: true },
    });

    let status = 0;
    let message = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
      });
      const data: any = await res.json().catch(() => null);

      if (typeof data?.usage?.cost === 'number') meta.cost += data.usage.cost;
      if (res.ok) {
        const content = data?.choices?.[0]?.message?.content;
        const text = (typeof content === 'string' ? content : '').trim();
        if (text) return { text, modelUsed: data?.model || model };
        throw new Error(`OpenRouter returned an empty response from ${model}.`);
      }

      status = res.status;
      message = data?.error?.message || res.statusText;
      lastError = new Error(`OpenRouter ${status}: ${message}`);
      const isTransient = status === 429 || status >= 500;
      if (!isTransient || attempt === 1) break;
      console.warn(`[OpenRouter] ${model}: ${status}, retrying once...`);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    if (!isModelUnavailable(status, message)) break;
    console.warn(`[OpenRouter] ${model} unavailable (${status}: ${message}), trying the next model.`);
  }

  throw lastError || new Error('OpenRouter request failed.');
}

/**
 * Asks OpenRouter whether the key is accepted, without generating anything (no credits used).
 * Only the status and OpenRouter's message are returned, never the key or its usage.
 */
async function checkOpenRouterKey(apiKey: string): Promise<{ ok: boolean; status: number; message: string }> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${apiKey}` } });
    const data: any = await res.json().catch(() => null);
    return {
      ok: res.ok,
      status: res.status,
      message: res.ok ? 'OpenRouter accepted the key.' : data?.error?.message || res.statusText,
    };
  } catch (err: any) {
    return { ok: false, status: 0, message: `Could not reach OpenRouter: ${err?.message || err}` };
  }
}

/** Whether OpenRouter currently serves a model (has at least one provider endpoint). */
async function checkOpenRouterModel(apiKey: string, model: string): Promise<{ model: string; available: boolean; status: number }> {
  try {
    const res = await fetch(`https://openrouter.ai/api/v1/models/${model}/endpoints`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data: any = await res.json().catch(() => null);
    const endpoints = data?.data?.endpoints;
    return { model, available: res.ok && (!Array.isArray(endpoints) || endpoints.length > 0), status: res.status };
  } catch {
    return { model, available: false, status: 0 };
  }
}

/** /api/health, and with ?check also whether OpenRouter accepts the server key and serves the models. */
export async function handleHealth(serverKey = nodeServerKey(), check = false): Promise<HandlerResult> {
  const key = (serverKey || '').trim();
  const body: Record<string, unknown> = { status: 'ok', hasServerKey: Boolean(key) };
  if (check && key) {
    body.openrouter = await checkOpenRouterKey(key);
    body.models = await Promise.all(OPENROUTER_MODELS.map((m) => checkOpenRouterModel(key, m)));
  }
  return { status: 200, body };
}

/** The app always generates with OPENROUTER_MODEL, so that is the one model offered. */
export async function handleModels(
  userApiKey: string | undefined,
  serverKey = nodeServerKey()
): Promise<HandlerResult> {
  if (!resolveApiKey(userApiKey, serverKey)) {
    return { status: 400, body: { error: { code: 400, message: 'No API key provided and no server key configured.' } } };
  }
  return {
    status: 200,
    body: {
      models: [{ id: OPENROUTER_MODEL, name: OPENROUTER_MODEL, displayName: 'Gemini 3.1 Flash Lite (OpenRouter)' }],
    },
  };
}

// Caps what one call can send to the model, so a single request cannot burn a large amount of tokens.
const MAX_TEXT_CHARS = 12_000;
const MAX_SIDE_CHARS = 3_000;
const tooLong = (value: unknown, max: number) => typeof value === 'string' && value.length > max;
const tooLongResult = (length: number, max: number): HandlerResult => ({
  status: 413,
  body: { error: { code: 413, reason: 'too_long', message: 'The text is too long. Shorten it and try again.' } },
  meta: { cost: 0, error: 'long', detail: `${length} > ${max}` },
});

export interface GenerateInput {
  rawText: string;
  exclusions?: string;
  domain?: DomainType;
  depth?: DepthType;
  /** Sent by the client; ignored — generation always uses OPENROUTER_MODEL. */
  model?: string;
  /** Sent by older clients; ignored — the server's own EXACT_SYSTEM_INSTRUCTION is always used. */
  systemInstruction?: string;
  outputLanguage?: OutputLanguage;
  /** True when the user already answered (or skipped) the clarifying questions. */
  skipClarify?: boolean;
}

export async function handleGenerate(
  input: GenerateInput,
  userApiKey: string | undefined,
  serverKey = nodeServerKey(),
  options: CallOptions = {}
): Promise<HandlerResult> {
  const { rawText, exclusions, domain, depth, outputLanguage, skipClarify } = input || ({} as GenerateInput);
  const maxChars = options.maxChars ?? MAX_TEXT_CHARS;
  const models = options.models?.length ? options.models : OPENROUTER_MODELS;
  const meta: CallMeta = { cost: 0 };

  if (!rawText || !rawText.trim()) {
    return { status: 400, body: { error: { code: 400, message: 'Text input is required.' } } };
  }
  if (tooLong(rawText, maxChars)) return tooLongResult(rawText.length, maxChars);
  if (tooLong(exclusions, MAX_SIDE_CHARS)) return tooLongResult(String(exclusions).length, MAX_SIDE_CHARS);

  const activeKey = resolveApiKey(userApiKey, serverKey);
  const localPrompt = () =>
    generateLocalStructuredPrompt({
      rawText: rawText.trim(),
      domain: domain || 'general',
      depth: depth || ('medium' as DepthType),
      outputLanguage: outputLanguage || 'match',
      exclusions,
    });

  if (!activeKey) {
    return { status: 200, body: { result: localPrompt(), fallbackUsed: true, modelUsed: 'Local Smart Engine' } };
  }

  try {
    // Step 1: the model extracts what the user asked for as a JSON brief.
    const extractionInstruction = buildSystemInstruction({
      // Never the client's copy: a cached page or an old saved one would bring back outdated rules.
      baseInstruction: EXACT_SYSTEM_INSTRUCTION,
      domain,
      depth,
      outputLanguage,
      exclusions,
      requestText: rawText,
    });

    const { text, modelUsed } = await generateWithOpenRouter(
      activeKey,
      { systemInstruction: extractionInstruction, userText: rawText.trim(), temperature: 0.1 },
      models,
      meta
    );

    let brief = parseBrief(text);
    if (!brief) throw new Error(`${modelUsed} did not return a readable brief.`);

    // Too vague to plan well: ask the user first (they can answer or skip).
    if (options.clarify !== false && !skipClarify && brief.clarifyingQuestions.length) {
      return { status: 200, body: { clarify: brief.clarifyingQuestions, modelUsed }, meta };
    }

    // Check the brief against the request; on a problem, the model fixes its own brief once.
    const language = resolveOutputLanguage(outputLanguage, rawText);
    const scope = { domain, depth };
    const issues = checkBrief(brief, rawText, exclusions, language, scope);
    let repaired = false;
    if (issues.length) {
      try {
        const fix = await generateWithOpenRouter(
          activeKey,
          {
            systemInstruction: extractionInstruction,
            userText: rawText.trim(),
            temperature: 0.1,
            followUp: [
              { role: 'assistant', content: text },
              { role: 'user', content: repairRequest(issues) },
            ],
          },
          models,
          meta
        );
        const fixed = parseBrief(fix.text);
        // Keep the fix only when it is readable and leaves fewer problems.
        if (fixed && checkBrief(fixed, rawText, exclusions, language, scope).length < issues.length) {
          brief = fixed;
          repaired = true;
        }
      } catch (err: any) {
        console.warn('[Generate] Repair failed, keeping the first brief:', String(err?.message || err));
      }
    }

    // Step 2: code builds the prompt from the brief, so structure and boundaries never vary.
    const result = composePrompt({ brief, domain, depth, language, exclusions });
    return {
      status: 200,
      body: { result, modelUsed, check: { issues: issues.map((i) => i.kind), repaired } },
      meta,
    };
  } catch (err: any) {
    // With a key configured, a failure means the model is busy or down. Say so (the site offers a
    // retry) rather than handing back a much weaker offline prompt as if it were the real result.
    const reason = String(err?.message || err);
    console.warn('[Generate] Model unavailable:', reason);
    return {
      status: 503,
      body: { error: { code: 503, reason: 'model_unavailable', message: 'The AI model is busy or unavailable. Try again shortly.', detail: reason } },
      meta: { ...meta, error: errorType(reason), detail: reason.slice(0, 300) },
    };
  }
}

export interface RefineInput {
  rawText: string;
  /** Sent by the client; ignored — generation always uses OPENROUTER_MODEL. */
  model?: string;
  domain?: string;
}

export async function handleRefine(
  input: RefineInput,
  userApiKey: string | undefined,
  serverKey = nodeServerKey(),
  options: CallOptions = {}
): Promise<HandlerResult> {
  const { rawText, domain } = input || ({} as RefineInput);
  const maxChars = options.maxChars ?? MAX_TEXT_CHARS;
  const meta: CallMeta = { cost: 0 };

  if (!rawText || !rawText.trim()) {
    return { status: 400, body: { error: { code: 400, message: 'Raw text is required to refine.' } } };
  }
  if (tooLong(rawText, maxChars)) return tooLongResult(rawText.length, maxChars);

  const activeKey = resolveApiKey(userApiKey, serverKey);

  if (!activeKey) {
    const localResult = refineLocalPromptText({ rawText, domain });
    return { status: 200, body: { result: localResult, fallbackUsed: true } };
  }

  try {
    const refineSystemInstruction = buildRefineInstruction(domain as DomainType | undefined, rawText);

    const { text: refinedText, modelUsed } = await generateWithOpenRouter(
      activeKey,
      { systemInstruction: refineSystemInstruction, userText: rawText.trim(), temperature: 0.2 },
      options.models?.length ? options.models : OPENROUTER_MODELS,
      meta
    );

    // A much longer rewrite has added content; keep the user's words, only tidied.
    if (refineAddsContent(rawText, refinedText)) {
      return {
        status: 200,
        body: { result: refineLocalPromptText({ rawText }), fallbackUsed: true, fallbackReason: 'Rewrite added content' },
        meta,
      };
    }

    return { status: 200, body: { result: refinedText, modelUsed }, meta };
  } catch (err: any) {
    const fallbackReason = String(err?.message || err);
    console.warn('[Refine Resilience] OpenRouter unavailable/busy, using smart local refiner fallback:', fallbackReason);
    const fallbackResult = refineLocalPromptText({ rawText, domain });
    return {
      status: 200,
      body: { result: fallbackResult, fallbackUsed: true, fallbackReason, modelFailed: true },
      meta: { ...meta, error: errorType(fallbackReason), detail: fallbackReason.slice(0, 300) },
    };
  }
}
