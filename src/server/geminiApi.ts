/**
 * Shared Gemini request handling, decoupled from any HTTP framework.
 *
 * Both server.ts (the Express server AI Studio / Cloud Run run) and the
 * files under /api (Vercel Serverless Functions) call these same functions,
 * so the two deployment targets can never drift apart on how a request is
 * actually handled — only the thin req/res adapter at each entry point differs.
 */
import { GoogleGenAI } from '@google/genai';
import { EXACT_SYSTEM_INSTRUCTION, buildSystemInstruction } from '../constants.js';
import { refineLocalPromptText } from '../services/localRefiner.js';
import { generateLocalStructuredPrompt } from '../services/localEngine.js';
import { DomainType, DepthType, OutputLanguage } from '../types.js';

export interface HandlerResult {
  status: number;
  body: unknown;
}

/** Maps a requested (possibly retired) model id to one still served by the API. */
export function sanitizeModelId(raw?: string): string {
  if (!raw || !raw.trim()) return 'gemini-3.8-flash';
  const clean = raw.trim().replace(/^models\//, '');
  if (clean.includes('2.5-flash') || clean.includes('2.0-flash') || clean.includes('1.5-flash')) {
    return 'gemini-3.6-flash';
  }
  if (clean.includes('2.5-pro') || clean.includes('2.0-pro') || clean.includes('1.5-pro')) {
    return 'gemini-3.1-pro-preview';
  }
  return clean || 'gemini-3.8-flash';
}

/** Tries the requested model, then falls through a fixed candidate list on 503/429. */
export async function generateWithGeminiCascade(
  client: GoogleGenAI,
  primaryModel: string | undefined,
  params: { contents: any; config: any }
): Promise<{ text: string; modelUsed: string }> {
  const cleanPrimary = sanitizeModelId(primaryModel);
  const candidates = Array.from(
    new Set([cleanPrimary, 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'])
  );

  let lastError: any = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const response = await client.models.generateContent({
        model: candidate,
        contents: params.contents,
        config: params.config,
      });

      let text = (response.text || '').trim();
      if (!text && response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.text && !part.thought) {
            text += part.text;
          }
        }
        text = text.trim();
      }

      if (text) {
        return { text, modelUsed: candidate };
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      const isTransient =
        errMsg.includes('503') ||
        errMsg.includes('high demand') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        err?.status === 503 ||
        err?.status === 429;

      if (isTransient && i < candidates.length - 1) {
        console.warn(`[Model Failover] ${candidate} busy (${err?.status || 503}), attempting ${candidates[i + 1]}...`);
        await new Promise((resolve) => setTimeout(resolve, 350));
        continue;
      }
      break;
    }
  }

  throw lastError || new Error('No candidate model could fulfill the request.');
}

export function handleHealth(): HandlerResult {
  return { status: 200, body: { status: 'ok', hasServerKey: Boolean(process.env.GEMINI_API_KEY) } };
}

export async function handleModels(userApiKey: string | undefined): Promise<HandlerResult> {
  try {
    const activeKey = (userApiKey || '').trim() || process.env.GEMINI_API_KEY;

    if (!activeKey) {
      return { status: 400, body: { error: { code: 400, message: 'No API key provided and no server key configured.' } } };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(activeKey)}`;
    const googleRes = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': activeKey },
    });
    const data = await googleRes.json().catch(() => null);

    if (!googleRes.ok) {
      return { status: googleRes.status, body: data };
    }

    const DEPRECATED_SUBSTRINGS = ['gemini-1.5', 'gemini-2.0', 'gemini-2.5', 'gemini-pro', 'aqa'];

    const eligibleModels = (data.models || [])
      .filter((m: any) => {
        const methods: string[] = m.supportedGenerationMethods || [];
        if (!methods.includes('generateContent')) return false;
        const rawName: string = m.name || '';
        const cleanId = rawName.replace(/^models\//, '');
        if (DEPRECATED_SUBSTRINGS.some((dep) => cleanId.includes(dep))) return false;
        return true;
      })
      .map((m: any) => {
        const rawName: string = m.name || '';
        const cleanId = rawName.replace(/^models\//, '');
        return {
          id: cleanId,
          name: rawName,
          displayName: m.displayName || cleanId,
          description: m.description,
          supportedGenerationMethods: m.supportedGenerationMethods,
        };
      })
      .sort((a: any, b: any) => {
        const priorityOrder = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'];
        const idxA = priorityOrder.indexOf(a.id);
        const idxB = priorityOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.id.localeCompare(b.id);
      });

    if (eligibleModels.length === 0) {
      eligibleModels.push(
        { id: 'gemini-3.8-flash', name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash (افتراضي)' },
        { id: 'gemini-3.6-flash', name: 'models/gemini-3.6-flash', displayName: 'Gemini 3.6 Flash' },
        { id: 'gemini-3.1-pro-preview', name: 'models/gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro' },
        { id: 'gemini-3.1-flash-lite', name: 'models/gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash Lite' }
      );
    }

    return { status: 200, body: { models: eligibleModels } };
  } catch (err: any) {
    return { status: 500, body: { error: { code: 500, message: err?.message || 'Failed to fetch models from Gemini server.' } } };
  }
}

export interface GenerateInput {
  rawText: string;
  exclusions?: string;
  domain?: DomainType;
  depth?: DepthType;
  model?: string;
  systemInstruction?: string;
  outputLanguage?: OutputLanguage;
}

export async function handleGenerate(input: GenerateInput, userApiKey: string | undefined): Promise<HandlerResult> {
  const { rawText, exclusions, domain, depth, model, systemInstruction, outputLanguage } = input || ({} as GenerateInput);

  if (!rawText || !rawText.trim()) {
    return { status: 400, body: { error: { code: 400, message: 'Text input is required.' } } };
  }

  const activeKey = (userApiKey || '').trim() || process.env.GEMINI_API_KEY;

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

    const client = new GoogleGenAI({ apiKey: activeKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });

    const { text: generatedText, modelUsed } = await generateWithGeminiCascade(client, model, {
      contents: [{ role: 'user', parts: [{ text: rawText.trim() }] }],
      config: { systemInstruction: fullSystemInstruction, temperature: 0.3 },
    });

    return { status: 200, body: { result: generatedText, modelUsed } };
  } catch (err: any) {
    console.warn('[Generate Resilience] Gemini unavailable/busy, using smart local engine fallback:', err?.message || err);
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
  model?: string;
  domain?: string;
}

export async function handleRefine(input: RefineInput, userApiKey: string | undefined): Promise<HandlerResult> {
  const { rawText, model, domain } = input || ({} as RefineInput);

  if (!rawText || !rawText.trim()) {
    return { status: 400, body: { error: { code: 400, message: 'Raw text is required to refine.' } } };
  }

  const activeKey = (userApiKey || '').trim() || process.env.GEMINI_API_KEY;

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

    const client = new GoogleGenAI({ apiKey: activeKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });

    const { text: refinedText, modelUsed } = await generateWithGeminiCascade(client, model, {
      contents: [{ role: 'user', parts: [{ text: rawText.trim() }] }],
      config: { systemInstruction: refineSystemInstruction, temperature: 0.35 },
    });

    return { status: 200, body: { result: refinedText, modelUsed } };
  } catch (err: any) {
    console.warn('[Refine Resilience] Gemini unavailable/busy, using smart local refiner fallback:', err?.message || err);
    const fallbackResult = refineLocalPromptText({ rawText, domain });
    return { status: 200, body: { result: fallbackResult, fallbackUsed: true } };
  }
}
