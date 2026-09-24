import {
  DomainType,
  DepthType,
  OutputLanguage,
  ModelInfo,
  GenerationErrorDetails,
} from '../types';
import { EXACT_SYSTEM_INSTRUCTION } from '../constants';
import { refineLocalPromptText } from './localRefiner';
import { generateLocalStructuredPrompt } from './localEngine';
import { dailyLimitError } from './account';

/**
 * All AI calls go through this app's own /api endpoints (the Cloudflare Worker, or
 * server.ts locally), which hold the only API key (OPENROUTER_API_KEY). The browser
 * never talks to the AI provider directly.
 */

class ApiError extends Error {
  details: GenerationErrorDetails;

  constructor(details: GenerationErrorDetails) {
    super(details.rawMessage);
    this.name = 'ApiError';
    this.details = details;
  }
}

/**
 * Strips the outer markdown code fence (e.g. ```markdown ... ```) from the model's reply.
 * Fences inside the prompt itself are left alone.
 */
function stripMarkdownFences(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, '');
    cleaned = cleaned.replace(/\n?```\s*$/, '');
  }

  return cleaned.trim();
}

/** Reads the error body the app's /api endpoints return: { error: { code, message } }. */
function parseApiError(statusCode: number, errorData: any): GenerationErrorDetails {
  const errObj = errorData?.error || {};
  const rawMessage =
    errObj.message || errorData?.message || (typeof errorData === 'string' ? errorData : `HTTP ${statusCode}`);

  const result: GenerationErrorDetails = { statusCode, statusText: `HTTP ${statusCode}`, rawMessage };

  if (statusCode === 429) {
    result.isRateLimitMinute = true;
    result.userGuidance = 'تم تجاوز عدد الطلبات المسموح. أعد المحاولة بعد لحظات.';
  } else if (statusCode === 401 || statusCode === 403) {
    result.isInvalidKey = true;
    result.userGuidance = 'OpenRouter رفض مفتاح السيرفر. راجع OPENROUTER_API_KEY في إعدادات Cloudflare.';
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
    throw new ApiError({
      statusCode: 0,
      rawMessage: `خطأ اتصال: ${networkErr?.message || 'تعذر الاتصال بالخادم'}`,
    });
  }
  const data = await res.json().catch(() => null);
  return { res, data };
}

function requireModel(model: string) {
  if (!model || !model.trim()) {
    throw new ApiError({
      statusCode: 400,
      rawMessage: 'لم يتم اختيار نموذج. اضغط "تحديث" بجانب قائمة النماذج ثم اختر نموذجًا.',
    });
  }
}

/** Fetches the models the server offers (currently the single OpenRouter model). */
export async function fetchModels(): Promise<ModelInfo[]> {
  let res: Response;
  try {
    res = await fetch('/api/models');
  } catch (networkErr: any) {
    throw new ApiError({
      statusCode: 0,
      rawMessage: `تعذر الاتصال بالسيرفر: ${networkErr?.message || 'خطأ شبكة'}`,
    });
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(parseApiError(res.status, data));
  }

  const models: ModelInfo[] = Array.isArray(data?.models) ? data.models : [];
  if (models.length === 0) {
    throw new ApiError({
      statusCode: res.status,
      rawMessage: 'لم يرجع السيرفر أي نموذج متاح.',
    });
  }

  return models;
}

const BACKOFF_DELAYS_MS = [1000, 2000, 4000];

/**
 * Sends the request to /api/generate, where the system instruction and the
 * user's text go to the model as separate messages.
 * On 429 it retries after 1s, 2s and 4s; any other failure falls back to the local engine.
 * A used-up daily limit throws DailyLimitError instead.
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
    throw new ApiError({
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

    // Out of prompts for today: the UI explains it (and offers sign-in), no local fallback.
    const limitError = dailyLimitError(res.status, data);
    if (limitError) throw limitError;

    const parsed = parseApiError(res.status, data);
    if (res.status !== 429 || attempt >= BACKOFF_DELAYS_MS.length) {
      // Never block the user: any other failure, or an empty reply, gets the local engine's prompt.
      console.warn('API returned no prompt, using the local engine:', res.status, parsed.rawMessage);
      return generateLocalStructuredPrompt({
        rawText: rawText.trim(),
        domain,
        depth,
        outputLanguage,
        exclusions,
      });
    }

    const waitMs = BACKOFF_DELAYS_MS[attempt];
    onRetry?.(attempt + 1, Math.round(waitMs / 1000), parsed.isRateLimitMinute === true);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

/**
 * Asks the model (via /api/refine) to clarify the wording of the raw request.
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

    const limitError = dailyLimitError(res.status, data);
    if (limitError) throw limitError;

    if (res.ok && data?.result && String(data.result).trim()) {
      return String(data.result).trim();
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'DailyLimitError') throw err;
    console.warn('Backend refine request threw an error, using local refiner fallback:', err);
  }

  // Bulletproof fallback: Never throw EMPTY_RESPONSE or fail!
  return refineLocalPromptText({ rawText, domain });
}
