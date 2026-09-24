import { DomainType, DepthType, OutputLanguage } from '../types.js';
import { composePrompt, localBrief, resolveOutputLanguage } from '../prompting.js';

/**
 * Offline prompt builder, used when no API key is set or the model is unavailable.
 * It runs the same composer as the model path (prompting.ts) on a brief built from the raw
 * request, so the fallback has the same structure for the selected depth.
 */
export function generateLocalStructuredPrompt(params: {
  rawText: string;
  domain: DomainType;
  depth: DepthType;
  outputLanguage: OutputLanguage;
  exclusions?: string;
}): string {
  const request = params.rawText.trim();
  const language = resolveOutputLanguage(params.outputLanguage, request);
  return composePrompt({
    brief: localBrief(request, params.domain, language),
    domain: params.domain,
    depth: params.depth,
    language,
    exclusions: params.exclusions,
  });
}
