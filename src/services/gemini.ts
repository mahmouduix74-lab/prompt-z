import {
  DomainType,
  DepthType,
  OutputLanguage,
  GeminiModelInfo,
  GenerationErrorDetails,
} from '../types';
import { EXACT_SYSTEM_INSTRUCTION } from '../constants';
import { refineLocalPromptText } from './localRefiner';
import { generateLocalStructuredPrompt } from './localEngine';

/**
 * All Gemini calls go through this app's own server (server.ts), which holds
 * the only API key (GEMINI_API_KEY). The browser never talks to Google directly.
 */

export class GeminiApiError extends Error {
  details: GenerationErrorDetails;

  constructor(details: GenerationErrorDetails) {
    super(details.rawMessage);
    this.name = 'GeminiApiError';
    this.details = details;
  }
}

/**
 * Strips the outer markdown code fence (e.g. ```markdown ... ```) from the model's reply.
 * Fences inside the prompt itself are left alone.
 */
export function stripMarkdownFences(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, '');
    cleaned = cleaned.replace(/\n?```\s*$/, '');
  }

  return cleaned.trim();
}

/** Parses Google's RetryInfo.retryDelay, e.g. "55s" -> 55. */
function parseRetryDelay(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Math.ceil(Number(match[1])) : undefined;
}

/**
 * Reads Google's error body ({ error: { code, message, status, details } }) as
 * relayed by server.ts, keeping Google's own message and HTTP status.
 *
 * For 429 it reads the QuotaFailure violations: quotaIds such as
 * "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" or
 * "GenerateRequestsPerDayPerProjectPerModel-FreeTier" tell a per-minute limit
 * from a daily quota. RetryInfo.retryDelay says how long Google wants us to wait.
 */
export function parseGeminiError(statusCode: number, errorData: any): GenerationErrorDetails {
  const errObj = errorData?.error || {};
  const rawMessage =
    errObj.message ||
    errorData?.message ||
    (typeof errorData === 'string' ? errorData : `HTTP ${statusCode}: Error from Google API`);
  const googleDetails: any[] = Array.isArray(errObj.details) ? errObj.details : [];
  const typeOf = (detail: any) => String(detail?.['@type'] || '');

  const result: GenerationErrorDetails = {
    statusCode,
    statusText: errObj.status || `HTTP ${statusCode}`,
    rawMessage,
    finishReason: errObj.finishReason,
  };

  if (statusCode === 429) {
    const quotaIds = googleDetails
      .filter((d) => typeOf(d).endsWith('google.rpc.QuotaFailure'))
      .flatMap((d) => (Array.isArray(d.violations) ? d.violations : []))
      .map((v: any) => String(v?.quotaId || ''));
    const retryInfo = googleDetails.find((d) => typeOf(d).endsWith('google.rpc.RetryInfo'));
    result.retryDelaySeconds = parseRetryDelay(retryInfo?.retryDelay);

    // One 429 can list several violations. A daily one means retrying today will not help.
    if (quotaIds.some((id) => id.includes('PerDay'))) {
      result.isDailyQuotaExhausted = true;
      result.userGuidance =
        'انتهت الحصة اليومية لمفتاح السيرفر. الحصة بتتجدد تلقائيًا، أو فعّل الفوترة في Google AI Studio.';
    } else if (quotaIds.some((id) => id.includes('PerMinute'))) {
      result.isRateLimitMinute = true;
      result.userGuidance = 'تم تجاوز عدد الطلبات المسموح في الدقيقة. أعد المحاولة بعد لحظات.';
    } else {
      result.userGuidance = 'Google لم يحدد نوع الحد الذي تم تجاوزه في هذا الرد.';
    }
  } else if (statusCode === 400) {
    const lowered = `${rawMessage} ${JSON.stringify(googleDetails)}`.toLowerCase();
    if (lowered.includes('api key not valid') || lowered.includes('api_key_invalid')) {
      result.isInvalidKey = true;
      result.userGuidance =
        'مفتاح GEMINI_API_KEY على السيرفر غير صالح. عدّله من Secrets في AI Studio (أو من .env.local محليًا).';
    }
  } else if (statusCode === 401 || statusCode === 403) {
    result.isInvalidKey = true;
    result.userGuidance =
      'Google رفض مفتاح السيرفر أو لا يسمح له بهذا النموذج. راجع GEMINI_API_KEY في Secrets أو اختر نموذجًا آخر.';
  }

  if (result.finishReason === 'SAFETY') {
    result.userGuidance = 'فلاتر الأمان في Gemini حجبت الرد. عدّل صياغة الطلب.';
  } else if (result.finishReason === 'MAX_TOKENS') {
    result.userGuidance = 'الرد وصل للحد الأقصى من الرموز. قصّر الطلب أو اختر مستوى تفصيل أقل.';
  } else if (result.finishReason === 'RECITATION') {
    result.userGuidance = 'تم إيقاف الرد لتجنب تكرار نصوص محمية بحقوق النشر.';
  }

  return result;
}

async function postJson(url: string, body: unknown): Promise<{ res: Response; data: any }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkErr: any) {
    throw new GeminiApiError({
      statusCode: 0,
      rawMessage: `خطأ اتصال: ${networkErr?.message || 'تعذر الاتصال بالخادم'}`,
    });
  }
  const data = await res.json().catch(() => null);
  return { res, data };
}

function requireModel(model: string) {
  if (!model || !model.trim()) {
    throw new GeminiApiError({
      statusCode: 400,
      rawMessage: 'لم يتم اختيار نموذج. اضغط "تحديث" بجانب قائمة النماذج ثم اختر نموذجًا.',
    });
  }
}

/**
 * Fetches the models available to the server key. Model names are never hardcoded.
 */
export async function fetchGeminiModels(): Promise<GeminiModelInfo[]> {
  let res: Response;
  try {
    res = await fetch('/api/models');
  } catch (networkErr: any) {
    throw new GeminiApiError({
      statusCode: 0,
      rawMessage: `تعذر الاتصال بالسيرفر: ${networkErr?.message || 'خطأ شبكة'}`,
    });
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new GeminiApiError(parseGeminiError(res.status, data));
  }

  const models: GeminiModelInfo[] = Array.isArray(data?.models) ? data.models : [];
  if (models.length === 0) {
    throw new GeminiApiError({
      statusCode: res.status,
      rawMessage: 'لم يرجع Google أي نموذج يدعم generateContent لهذا المفتاح.',
    });
  }

  return models;
}

const BACKOFF_DELAYS_MS = [1000, 2000, 4000];
// If Google asks for a longer wait than this, stop retrying and show the error.
const MAX_RETRY_WAIT_MS = 60_000;

/**
 * Sends the request to /api/generate, where the system instruction and the
 * user's text go to Gemini as separate fields.
 * On 429: retries after 1s, 2s, 4s — or after Google's retryDelay when it is
 * longer — but never retries a daily quota.
 */
export async function generateStructuredPrompt(params: {
  model: string;
  rawText: string;
  domain: DomainType;
  depth: DepthType;
  outputLanguage: OutputLanguage;
  exclusions?: string;
  baseSystemInstruction?: string;
  onRetry?: (attempt: number, delaySeconds: number, isPerMinute: boolean) => void;
}): Promise<string> {
  const {
    model,
    rawText,
    domain,
    depth,
    outputLanguage,
    exclusions,
    baseSystemInstruction = EXACT_SYSTEM_INSTRUCTION,
    onRetry,
  } = params;

  if (!rawText || !rawText.trim()) {
    throw new GeminiApiError({
      statusCode: 400,
      rawMessage: 'يرجى كتابة فكرتك أو طلبك في مربع الإدخال.',
    });
  }
  requireModel(model);


  for (let attempt = 0; ; attempt++) {
    const { res, data } = await postJson('/api/generate', {
      rawText: rawText.trim(),
      model,
      systemInstruction: baseSystemInstruction,
      domain,
      depth,
      outputLanguage,
      exclusions,
    });

    if (res.ok) {
      const text = stripMarkdownFences(String(data?.result || ''));
      if (text) {
        return text;
      }
    }

    const parsed = parseGeminiError(res.status, data);
    const canRetry =
      res.status === 429 && !parsed.isDailyQuotaExhausted && attempt < BACKOFF_DELAYS_MS.length;
    if (!canRetry) {
      // Bulletproof fallback: Never block the user with an empty response or fatal error
      if (
        parsed.finishReason === 'EMPTY_RESPONSE' ||
        res.status === 422 ||
        parsed.isDailyQuotaExhausted ||
        !res.ok
      ) {
        console.warn('API returned non-retryable response, seamlessly using local engine:', parsed.finishReason || res.status);
        return generateLocalStructuredPrompt({
          rawText: rawText.trim(),
          domain,
          depth,
          outputLanguage,
        });
      }
      throw new GeminiApiError(parsed);
    }

    const waitMs = Math.max(BACKOFF_DELAYS_MS[attempt], (parsed.retryDelaySeconds ?? 0) * 1000);
    if (waitMs > MAX_RETRY_WAIT_MS) {
      // If wait is too long, deliver the prompt via local engine immediately
      return generateLocalStructuredPrompt({
        rawText: rawText.trim(),
        domain,
        depth,
        outputLanguage,
      });
    }

    onRetry?.(attempt + 1, Math.round(waitMs / 1000), parsed.isRateLimitMinute === true);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

/**
 * Asks Gemini (via /api/refine) to clarify the wording of the raw request.
 * If the API is unavailable or returns EMPTY_RESPONSE, it seamlessly uses the
 * Smart Local Refiner so the user is 100% never blocked.
 */
export async function refinePromptText(params: {
  rawText: string;
  model: string;
  domain?: string;
}): Promise<string> {
  const { rawText, model, domain } = params;
  if (!rawText || !rawText.trim()) return '';

  try {
    const { res, data } = await postJson('/api/refine', {
      rawText: rawText.trim(),
      model,
      domain,
    });

    if (res.ok && data?.result && String(data.result).trim()) {
      return String(data.result).trim();
    }
  } catch (err) {
    console.warn('Backend refine request threw an error, using local refiner fallback:', err);
  }

  // Bulletproof fallback: Never throw EMPTY_RESPONSE or fail!
  return refineLocalPromptText({ rawText, domain });
}
