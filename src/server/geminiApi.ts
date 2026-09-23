/**
 * Shared AI request handling (OpenRouter), decoupled from any HTTP framework.
 *
 * The Cloudflare Worker (worker/index.ts), server.ts (the Express server for
 * local dev / Node hosts) and the files under /api (Vercel) call these same functions,
 * so the two deployment targets can never drift apart on how a request is
 * actually handled — only the thin req/res adapter at each entry point differs.
 */
import { EXACT_SYSTEM_INSTRUCTION, OPENROUTER_MODEL, buildSystemInstruction } from '../constants.js';
import { refineLocalPromptText } from '../services/localRefiner.js';
import { generateLocalStructuredPrompt } from '../services/localEngine.js';
import { DomainType, DepthType, OutputLanguage } from '../types.js';

export interface HandlerResult {
  status: number;
  body: unknown;
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

/**
 * Sends one chat completion to OpenRouter and returns the generated text.
 * Retries once on 429/5xx; any other failure is thrown for the caller's fallback.
 */
export async function generateWithOpenRouter(
  apiKey: string,
  params: { systemInstruction: string; userText: string; temperature: number }
): Promise<{ text: string; modelUsed: string }> {
  const body = JSON.stringify({
    model: OPENROUTER_MODEL,
    messages: [
      { role: 'system', content: params.systemInstruction },
      { role: 'user', content: params.userText },
    ],
    temperature: params.temperature,
  });

  let lastError: Error | null = null;
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

    if (res.ok) {
      const content = data?.choices?.[0]?.message?.content;
      const text = (typeof content === 'string' ? content : '').trim();
      if (text) return { text, modelUsed: data?.model || OPENROUTER_MODEL };
      throw new Error('OpenRouter returned an empty response.');
    }

    lastError = new Error(`OpenRouter ${res.status}: ${data?.error?.message || res.statusText}`);
    const isTransient = res.status === 429 || res.status >= 500;
    if (!isTransient || attempt === 1) break;
    console.warn(`[OpenRouter] ${res.status}, retrying once...`);
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  throw lastError || new Error('OpenRouter request failed.');
}

export function handleHealth(serverKey = nodeServerKey()): HandlerResult {
  return { status: 200, body: { status: 'ok', hasServerKey: Boolean((serverKey || '').trim()) } };
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
      models: [{ id: OPENROUTER_MODEL, name: OPENROUTER_MODEL, displayName: 'Gemini 2.0 Flash (OpenRouter)' }],
    },
  };
}

export interface GenerateInput {
  rawText: string;
  exclusions?: string;
  domain?: DomainType;
  depth?: DepthType;
  /** Sent by the client; ignored — generation always uses OPENROUTER_MODEL. */
  model?: string;
  systemInstruction?: string;
  outputLanguage?: OutputLanguage;
}

export async function handleGenerate(
  input: GenerateInput,
  userApiKey: string | undefined,
  serverKey = nodeServerKey()
): Promise<HandlerResult> {
  const { rawText, exclusions, domain, depth, systemInstruction, outputLanguage } = input || ({} as GenerateInput);

  if (!rawText || !rawText.trim()) {
    return { status: 400, body: { error: { code: 400, message: 'Text input is required.' } } };
  }

  const activeKey = resolveApiKey(userApiKey, serverKey);

  if (!activeKey) {
    const fallbackPrompt = generateLocalStructuredPrompt({
      rawText: rawText.trim(),
      domain: domain || 'general',
      depth: depth || ('medium' as DepthType),
      outputLanguage: outputLanguage || 'match',
    });
    return { status: 200, body: { result: fallbackPrompt, fallbackUsed: true, modelUsed: 'Local Smart Engine' } };
  }

  try {
    const fullSystemInstruction = buildSystemInstruction({
      baseInstruction: (systemInstruction || EXACT_SYSTEM_INSTRUCTION).trim(),
      domain,
      depth,
      outputLanguage,
      exclusions,
    });

    const { text: generatedText, modelUsed } = await generateWithOpenRouter(activeKey, {
      systemInstruction: fullSystemInstruction,
      userText: rawText.trim(),
      temperature: 0.3,
    });

    return { status: 200, body: { result: generatedText, modelUsed } };
  } catch (err: any) {
    console.warn('[Generate Resilience] OpenRouter unavailable/busy, using smart local engine fallback:', err?.message || err);
    const fallbackPrompt = generateLocalStructuredPrompt({
      rawText: rawText.trim(),
      domain: domain || 'general',
      depth: depth || ('medium' as DepthType),
      outputLanguage: outputLanguage || 'match',
    });
    return { status: 200, body: { result: fallbackPrompt, fallbackUsed: true, modelUsed: 'Local Smart Engine' } };
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
  serverKey = nodeServerKey()
): Promise<HandlerResult> {
  const { rawText, domain } = input || ({} as RefineInput);

  if (!rawText || !rawText.trim()) {
    return { status: 400, body: { error: { code: 400, message: 'Raw text is required to refine.' } } };
  }

  const activeKey = resolveApiKey(userApiKey, serverKey);

  if (!activeKey) {
    const localResult = refineLocalPromptText({ rawText, domain });
    return { status: 200, body: { result: localResult, fallbackUsed: true } };
  }

  try {
    const domainHint = domain ? `المجال المستهدف المختار هو: (${domain}).` : '';
    const refineSystemInstruction = `أنت خبير صياغة وهندسة برومبتات ومحرر تقني رفيع المستوى.
مهمتك: إعادة صياغة النص المدخل من المستخدم لجعله أكثر دقة ووضوحاً واحترافية قبل تحويله إلى الهيكل النهائي، دون إضافة أي متطلب جديد.

تعليمات الصياغة الدقيقة:
1. حافظ تماماً على نفس لغة المستخدم الأصلية (إذا كان باللغة العربية أجب بالعربية الفصحى الواضحة، وإذا كان بالإنجليزية أجب بالإنجليزية).
2. ${domainHint}
3. احتفظ بكل متطلب ذكره المستخدم دون حذف أو تغيير في المعنى، ووضّح المصطلحات الغامضة ورتّب الأفكار منطقياً فقط.
4. لا تضف أي ميزة أو شاشة أو قسم أو معيار أو حالة استخدام أو رقم لم يذكرها المستخدم صراحةً. لا تحوّل الطلب إلى مواصفات أو وثائق إذا كان الطلب تنفيذ عمل.
5. تخلص من الحشو اللغوي والتكرار أو التردد، واجعل التعبير مباشراً، متماسكاً، وقوياً.
6. أخرج فقط النص المُعاد صياغته والمحسّن مباشرة دون أي مقدمات (مثل: "إليك النص المحسن:" أو "Sure")، ودون علامات اقتباس، ودون أي خاتمة أو عروض مساعدة.
7. لا تقم بتحويله إلى هيكل البرومبت النهائي الآن (لا تستخدم # ROLE أو # CONTEXT حالياً)، بل اجعله نصاً واضحاً يراجعه المستخدم أولاً، بنفس نطاق طلبه الأصلي.`;

    const { text: refinedText, modelUsed } = await generateWithOpenRouter(activeKey, {
      systemInstruction: refineSystemInstruction,
      userText: rawText.trim(),
      temperature: 0.35,
    });

    return { status: 200, body: { result: refinedText, modelUsed } };
  } catch (err: any) {
    console.warn('[Refine Resilience] OpenRouter unavailable/busy, using smart local refiner fallback:', err?.message || err);
    const fallbackResult = refineLocalPromptText({ rawText, domain });
    return { status: 200, body: { result: fallbackResult, fallbackUsed: true } };
  }
}
