import type { Lang } from './theme';

export type PromptLine =
  | { kind: 'header'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'bullet'; text: string };

export interface Copy {
  dir: 'ltr' | 'rtl';
  hero: { prefix: string; words: string[]; suffix: string; lead: string };
  captions: {
    type: string;
    language: string;
    generate: string;
    snake: string;
    result: string;
  };
  ui: {
    domainLabel: string;
    domains: string[]; // index 1 is the one that gets selected (UI/UX)
    depthLabel: string;
    depths: string[]; // index 1 is selected (Medium)
    outputLanguageLabel: string;
    languages: string[]; // [match, Arabic, English]; English gets picked
    inputLabel: string;
    idea: string;
    generate: string;
    generating: string;
    outputLabel: string;
    copy: string;
    copied: string;
  };
  prompt: PromptLine[];
  outro: { tagline: string; cta: string; url: string };
}

// Hero, labels and buttons are the exact strings from src/utils/i18n.ts.
export const COPY: Record<Lang, Copy> = {
  en: {
    dir: 'ltr',
    hero: {
      prefix: 'Forge',
      words: ['Pro', 'Elite'],
      suffix: 'Prompts',
      lead: 'From First Idea to Final Prompt - In One Second',
    },
    captions: {
      type: 'Type your idea. Even in Arabic.',
      language: 'Choose your output language.',
      generate: 'Hit Generate.',
      snake: 'Play while it thinks',
      result: 'Get a pro prompt.\nIn English.',
    },
    ui: {
      domainLabel: 'Domain Context',
      domains: ['General', 'UI/UX Design', 'Frontend', 'Backend'],
      depthLabel: 'Detail Depth',
      depths: ['Short', 'Medium', 'Detailed', 'Ultra'],
      outputLanguageLabel: 'Output language',
      languages: ['Match my request', 'Arabic', 'English'],
      inputLabel: 'Raw Prompt / Idea',
      // The story: type in Egyptian Arabic, get the structured prompt in English.
      idea: 'عايز أصمم صفحة تسجيل دخول لتطبيق موبايل في Figma',
      generate: 'Generate Prompt',
      generating: 'Generating...',
      outputLabel: 'Structured Prompt',
      copy: 'Copy',
      copied: 'Copied!',
    },
    prompt: [
      { kind: 'header', text: '# ROLE' },
      { kind: 'text', text: 'Senior mobile product designer' },
      { kind: 'header', text: '# OBJECTIVE' },
      { kind: 'text', text: 'A clean, ready-to-build login screen.' },
      { kind: 'header', text: '# TASK' },
      { kind: 'text', text: 'Design the login screen in Figma' },
      { kind: 'bullet', text: 'Email and password fields' },
      { kind: 'bullet', text: 'Sign-in button' },
      { kind: 'bullet', text: 'Forgot password & sign-up links' },
      { kind: 'header', text: '# OUTPUT RULES' },
      { kind: 'bullet', text: 'Only the requested screen' },
      { kind: 'bullet', text: 'No preambles' },
    ],
    outro: {
      tagline: 'From First Idea to Final Prompt - In One Second',
      cta: 'Try it now',
      url: 'prompt-z-omega.vercel.app',
    },
  },
  ar: {
    dir: 'rtl',
    hero: {
      prefix: 'اصنع برومبتات',
      words: ['احترافية', 'فائقة'],
      suffix: '',
      lead: 'من الفكرة الأولى إلى البرومبت النهائي - في ثانية واحدة',
    },
    captions: {
      type: 'اكتب فكرتك بأي طريقة',
      language: 'اختر لغة المخرجات',
      generate: 'اضغط توليد',
      snake: 'العب لحد ما يجهز',
      result: 'برومبت احترافي جاهز',
    },
    ui: {
      domainLabel: 'المجال التخصصي',
      domains: ['عام', 'تصميم UI/UX', 'واجهات Frontend', 'أنظمة Backend'],
      depthLabel: 'مستوى التفصيل',
      depths: ['موجز', 'متوسط', 'مفصل', 'شامل'],
      outputLanguageLabel: 'لغة المخرجات',
      languages: ['نفس لغة الطلب', 'العربية', 'الإنجليزية'],
      inputLabel: 'فكرة أو متطلبات البرومبت',
      idea: 'عايز أصمم صفحة تسجيل دخول لتطبيق موبايل في Figma',
      generate: 'توليد البرومبت',
      generating: 'جاري التوليد...',
      outputLabel: 'البرومبت المنظم',
      copy: 'نسخ',
      copied: 'تم النسخ!',
    },
    // Headers stay in English (as the formatter outputs them); content follows the request language.
    prompt: [
      { kind: 'header', text: '# ROLE' },
      { kind: 'text', text: 'مصمم منتجات أول متخصص في تطبيقات الموبايل' },
      { kind: 'header', text: '# OBJECTIVE' },
      { kind: 'text', text: 'شاشة تسجيل دخول واضحة وجاهزة للتنفيذ.' },
      { kind: 'header', text: '# TASK' },
      { kind: 'text', text: 'صمّم شاشة تسجيل الدخول في Figma' },
      { kind: 'bullet', text: 'حقلا البريد وكلمة المرور' },
      { kind: 'bullet', text: 'زر تسجيل الدخول' },
      { kind: 'bullet', text: 'رابطا نسيت كلمة المرور وإنشاء حساب' },
      { kind: 'header', text: '# OUTPUT RULES' },
      { kind: 'bullet', text: 'الشاشة المطلوبة فقط' },
      { kind: 'bullet', text: 'بدون مقدمات' },
    ],
    outro: {
      tagline: 'من الفكرة الأولى إلى البرومبت النهائي - في ثانية واحدة',
      cta: 'جرّبه الآن',
      url: 'prompt-z-omega.vercel.app',
    },
  },
};
