export type OutputLanguage = 'match' | 'ar' | 'en';

export type DomainType =
  | 'general'
  | 'ui_ux'
  | 'frontend'
  | 'backend'
  | 'research'
  | 'content'
  | 'media';

export type DepthType = 'short' | 'medium' | 'detailed' | 'ultra';

export interface GeminiModelInfo {
  id: string; // model id returned by models.list, without the "models/" prefix
  name: string; // full resource name, e.g. "models/<id>"
  displayName: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

export interface SavedPromptItem {
  id: string;
  rawInput: string;
  exclusions?: string;
  domain: DomainType;
  depth: DepthType;
  outputLanguage?: OutputLanguage;
  model: string;
  output: string;
  timestamp: number;
}

export interface GenerationErrorDetails {
  statusCode?: number;
  statusText?: string;
  rawMessage: string;
  userGuidance?: string;
  isInvalidKey?: boolean;
  isRateLimitMinute?: boolean;
  isDailyQuotaExhausted?: boolean;
  retryDelaySeconds?: number;
  finishReason?: string;
  retryAttempt?: number;
  retryCountdown?: number;
}
