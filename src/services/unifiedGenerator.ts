import {
  DomainType,
  DepthType,
  OutputLanguage,
  GeminiModelInfo,
  GenerationErrorDetails,
} from '../types';
import { GeminiApiError, parseGeminiError } from './gemini';
import { generateLocalStructuredPrompt } from './localEngine';

/**
 * Universal Unified Prompt Generator:
 * 1. Tries the Server-Side API endpoint (/api/generate) using backend GEMINI_API_KEY.
 * 2. If the user provided a custom key, it passes it via x-api-key.
 * 3. If direct client-side call is requested or server key is unavailable, it tries client-side Gemini API.
 * 4. If any 400 (Invalid Argument) or key authentication fails, it seamlessly falls back
 *    to the high-precision Local Smart Engine so the user is NEVER blocked.
 */

export interface UnifiedGenerateParams {
  rawText: string;
  domain: DomainType;
  depth: DepthType;
  outputLanguage: OutputLanguage;
  model: string;
  apiKey?: string;
  useLocalOnly?: boolean;
  onRetry?: (attempt: number, waitSeconds: number) => void;
}

export interface UnifiedGenerateResult {
  text: string;
  engineUsed: 'server_ai' | 'client_ai' | 'local_engine';
  notice?: string;
}

/**
 * Checks if the backend server has a configured GEMINI_API_KEY
 */
export async function checkServerHealth(): Promise<{ status: string; hasServerKey: boolean }> {
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // server not reachable or running in static mode
  }
  return { status: 'offline', hasServerKey: false };
}

const DEPRECATED_SUBSTRINGS = ['gemini-1.5', 'gemini-2.0', 'gemini-2.5', 'gemini-pro', 'aqa'];

export function sanitizeModel(model?: string): string {
  if (!model || !model.trim()) return 'gemini-3.8-flash';
  const clean = model.trim().replace(/^models\//, '');
  if (clean.includes('2.5-flash') || clean.includes('2.0-flash') || clean.includes('1.5-flash')) {
    return 'gemini-3.6-flash';
  }
  if (clean.includes('2.5-pro') || clean.includes('2.0-pro') || clean.includes('1.5-pro')) {
    return 'gemini-3.1-pro-preview';
  }
  return clean || 'gemini-3.8-flash';
}

/**
 * Fetches models dynamically from server or direct Google API
 */
export async function fetchUnifiedModels(apiKey?: string): Promise<GeminiModelInfo[]> {
  const cleanKey = apiKey?.trim() || '';

  // 1. Try server-side endpoint first
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cleanKey) {
      headers['x-api-key'] = cleanKey;
    }

    const res = await fetch('/api/models', { method: 'GET', headers });
    if (res.ok) {
      const data = await res.json();
      if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
        return data.models;
      }
    }
  } catch {
    // fallback to direct API
  }

  // 2. If user provided a key and server failed, try direct Google API
  if (cleanKey) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
      cleanKey
    )}`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey,
      },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const parsed = parseGeminiError(res.status, data);
      throw new GeminiApiError(parsed);
    }

    if (data?.models && Array.isArray(data.models)) {
      return data.models
        .filter((m: any) => {
          const methods = m.supportedGenerationMethods || [];
          if (!methods.includes('generateContent')) return false;
          const cleanId = (m.name || '').replace(/^models\//, '');
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
        });
    }
  }

  // Default standard fallback models
  return [
    { id: 'gemini-3.8-flash', name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash (افتراضي)' },
    { id: 'gemini-3.6-flash', name: 'models/gemini-3.6-flash', displayName: 'Gemini 3.6 Flash' },
    { id: 'gemini-3.1-pro-preview', name: 'models/gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro' },
    { id: 'gemini-3.1-flash-lite', name: 'models/gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash Lite' },
  ];
}

/**
 * Main generator with automatic hybrid fallback
 */
export async function generateUnifiedPrompt(
  params: UnifiedGenerateParams
): Promise<UnifiedGenerateResult> {
  const { rawText, domain, depth, outputLanguage, model, apiKey, useLocalOnly } = params;

  // If user explicitly chose local offline mode
  if (useLocalOnly) {
    const localText = generateLocalStructuredPrompt({ rawText, domain, depth, outputLanguage });
    return {
      text: localText,
      engineUsed: 'local_engine',
      notice: 'تم التوليد بنجاح عبر المحرك الذكي المحلي بدون الحاجة إلى API Key.',
    };
  }

  const cleanKey = apiKey?.trim() || '';

  // 1. Try Server-Side API endpoint first
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cleanKey) {
      headers['x-api-key'] = cleanKey;
    }

    const effectiveModel = sanitizeModel(model);

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        rawText,
        domain,
        depth,
        outputLanguage,
        model: effectiveModel,
      }),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.result) {
      return {
        text: data.result,
        engineUsed: 'server_ai',
      };
    }

    // If server returned error due to key issues, high demand, or server issues, and no valid result
    if (!res.ok) {
      // Automatic fallback to local engine so user is NEVER blocked
      const localFallbackText = generateLocalStructuredPrompt({
        rawText,
        domain,
        depth,
        outputLanguage,
      });
      return {
        text: localFallbackText,
        engineUsed: 'local_engine',
        notice:
          'تم التوليد بنجاح عبر المحرك الذكي الاحتياطي لضمان استمرارية العمل فوراً دون انقطاع.',
      };
    }
  } catch {
    // server unreachable, fall through to client attempt or local engine
  }

  // 2. Direct client-side attempt if user provided key
  if (cleanKey) {
    try {
      const cleanModel = sanitizeModel(model);
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(
        cleanKey
      )}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: rawText.trim() }] }],
          generationConfig: { temperature: 0.3 },
        }),
      });

      const resData = await res.json().catch(() => null);
      if (res.ok) {
        const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { text, engineUsed: 'client_ai' };
        }
      }
    } catch {
      // client fetch error
    }
  }

  // 3. Guaranteed final fallback to Local Smart Engine
  const finalText = generateLocalStructuredPrompt({ rawText, domain, depth, outputLanguage });
  return {
    text: finalText,
    engineUsed: 'local_engine',
    notice: 'تم التوليد فوراً عبر المحرك الذكي المحلي (بدون الحاجة لمفتاح).',
  };
}
