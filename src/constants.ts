import { DomainType, DepthType, OutputLanguage } from './types.js';

export interface DomainOption {
  id: DomainType;
  labelAr: string;
  labelEn: string;
}

// Labels for the domain chips. What each domain means for the prompt is in prompting.ts.
export const DOMAINS: DomainOption[] = [
  { id: 'general', labelAr: 'عام', labelEn: 'General' },
  { id: 'ui_ux', labelAr: 'تصميم UI/UX', labelEn: 'UI/UX Design' },
  { id: 'graphic', labelAr: 'جرافيك وهوية', labelEn: 'Graphic & Brand' },
  { id: 'frontend', labelAr: 'واجهات Frontend', labelEn: 'Frontend' },
  { id: 'backend', labelAr: 'أنظمة Backend', labelEn: 'Backend' },
  { id: 'mobile', labelAr: 'تطبيقات موبايل', labelEn: 'Mobile Apps' },
  { id: 'devops', labelAr: 'DevOps وسحابة', labelEn: 'DevOps & Cloud' },
  { id: 'data', labelAr: 'بيانات وتحليلات', labelEn: 'Data & Analytics' },
  { id: 'ai_ml', labelAr: 'ذكاء اصطناعي', labelEn: 'AI & ML' },
  { id: 'product', labelAr: 'إدارة منتجات', labelEn: 'Product' },
  { id: 'marketing', labelAr: 'تسويق', labelEn: 'Marketing' },
  { id: 'content', labelAr: 'كتابة محتوى', labelEn: 'Content' },
  { id: 'media', labelAr: 'صور وفيديو', labelEn: 'Image/Video' },
  { id: 'research', labelAr: 'بحث وتحليل', labelEn: 'Research' },
  { id: 'education', labelAr: 'تعليم وتدريب', labelEn: 'Education' },
  { id: 'business', labelAr: 'بيزنس واستراتيجية', labelEn: 'Business' },
];

export interface DepthOption {
  id: DepthType;
  labelAr: string;
  labelEn: string;
}

// Labels for the depth tabs. What each depth means for the prompt is in prompting.ts.
export const DEPTHS: DepthOption[] = [
  {
    id: 'short',
    labelAr: 'موجز',
    labelEn: 'Short',
  },
  {
    id: 'medium',
    labelAr: 'متوسط',
    labelEn: 'Medium',
  },
  {
    id: 'detailed',
    labelAr: 'مفصل',
    labelEn: 'Detailed',
  },
  {
    id: 'ultra',
    labelAr: 'شامل',
    labelEn: 'Ultra',
  },
];

export interface OutputLanguageOption {
  id: OutputLanguage;
  labelAr: string;
  labelEn: string;
}

export const OUTPUT_LANGUAGES: OutputLanguageOption[] = [
  {
    id: 'match',
    labelAr: 'نفس لغة الطلب',
    labelEn: 'Match my request',
  },
  {
    id: 'ar',
    labelAr: 'العربية',
    labelEn: 'Arabic',
  },
  {
    id: 'en',
    labelAr: 'الإنجليزية',
    labelEn: 'English',
  },
];

/**
 * OpenRouter models, in order of preference. Requests use the first; a later one is tried only
 * when an earlier one is unavailable (OpenRouter retired google/gemini-2.0-flash-001 this way).
 */
export const OPENROUTER_MODELS = ['google/gemini-3.1-flash-lite', 'google/gemini-3.8-flash'];
export const OPENROUTER_MODEL = OPENROUTER_MODELS[0];

export { EXACT_SYSTEM_INSTRUCTION, EMPTY_TEMPLATE_PREVIEW, buildSystemInstruction } from './prompting.js';
