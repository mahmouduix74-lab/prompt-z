import { DomainType, DepthType, OutputLanguage } from './types.js';

export interface DomainOption {
  id: DomainType;
  labelAr: string;
  labelEn: string;
  instructionLine: string;
}

// Domain lines constrain phrasing only. None of them may add a deliverable the
// user did not ask for (see the matching rule in EXACT_SYSTEM_INSTRUCTION).
export const DOMAINS: DomainOption[] = [
  {
    id: 'general',
    labelAr: 'عام',
    labelEn: 'General',
    instructionLine:
      'Domain: General. Base the ROLE on: a specialist inferred from the request.',
  },
  {
    id: 'ui_ux',
    labelAr: 'تصميم UI/UX',
    labelEn: 'UI/UX Design',
    instructionLine:
      'Domain: UI/UX Design. Base the ROLE on: senior product designer. Word each TASK as the design to create (for example "Design the homepage screen"), never as a specification or documentation to write. Add to OUTPUT RULES: be concrete, not generic; deliver only the screens and elements requested, with no specification, documentation, anatomy or extra pages; use realistic image content (product photos, hero imagery, avatars) instead of gray boxes or line icons. In OUTPUT RULES, replace the "do not invent data, write "not available"" item with: use realistic placeholder content.',
  },
  {
    id: 'frontend',
    labelAr: 'واجهات Frontend',
    labelEn: 'Frontend',
    instructionLine:
      'Domain: Frontend. Base the ROLE on: senior frontend engineer. Add to OUTPUT RULES: name the framework only if the user named it; no backend scope.',
  },
  {
    id: 'backend',
    labelAr: 'أنظمة Backend',
    labelEn: 'Backend',
    instructionLine:
      'Domain: Backend. Base the ROLE on: senior backend engineer. Add to OUTPUT RULES: name data models, endpoints and constraints precisely where the user mentioned them; no UI scope.',
  },
  {
    id: 'research',
    labelAr: 'بحث وتحليل',
    labelEn: 'Research',
    instructionLine:
      'Domain: Research. Base the ROLE on: strategic researcher. Add to OUTPUT RULES: require a source link for every external claim; separate sourced facts from inference.',
  },
  {
    id: 'content',
    labelAr: 'كتابة محتوى',
    labelEn: 'Content',
    instructionLine:
      'Domain: Content. Base the ROLE on: senior copywriter. Add to OUTPUT RULES: state the target reader and tone only if the user gave them; no technical scope.',
  },
  {
    id: 'media',
    labelAr: 'صور وفيديو',
    labelEn: 'Image/Video',
    instructionLine:
      'Domain: Image/Video. Base the ROLE on: visual art director. Add to OUTPUT RULES: describe subject, composition, lighting and style only where the user specified them.',
  },
];

export interface DepthOption {
  id: DepthType;
  labelAr: string;
  labelEn: string;
  instructionLine: string;
}

export const DEPTHS: DepthOption[] = [
  {
    id: 'short',
    labelAr: 'موجز',
    labelEn: 'Short',
    // OUTPUT RULES stays: the domain line, language line and exclusions all live there.
    instructionLine:
      'Depth: Short. Output ROLE, OBJECTIVE, the tasks and OUTPUT RULES, one line each. Omit CONTEXT.',
  },
  {
    id: 'medium',
    labelAr: 'متوسط',
    labelEn: 'Medium',
    instructionLine: 'Depth: Medium. Output all sections, one to two lines each.',
  },
  {
    id: 'detailed',
    labelAr: 'مفصل',
    labelEn: 'Detailed',
    instructionLine: 'Depth: Detailed. Output sub-points under each task, expanded OUTPUT RULES.',
  },
  {
    id: 'ultra',
    labelAr: 'شامل',
    labelEn: 'Ultra',
    instructionLine:
      'Depth: Ultra-detailed. Output sub-points naming exact deliverables and explicit constraints.',
  },
];

export interface OutputLanguageOption {
  id: OutputLanguage;
  labelAr: string;
  labelEn: string;
  // No line for "match": the base instruction already uses the language of the user's message.
  instructionLine?: string;
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
    instructionLine:
      "Output language: Arabic. Write the section content in Arabic and set the language line under # OUTPUT RULES to Arabic, instead of the language of the user's message. Keep the headers in English.",
  },
  {
    id: 'en',
    labelAr: 'الإنجليزية',
    labelEn: 'English',
    instructionLine:
      "Output language: English. Write the section content in English and set the language line under # OUTPUT RULES to English, instead of the language of the user's message.",
  },
];

// Requests used while tuning the formatter; clicking one fills the textarea.
export const STARTER_EXAMPLES: string[] = [
  'التقرير طويل أوي، عايزه أبسط وبالذات جزء تحليل المنافسين',
  'عايز أعرف مين المنافسين وإيه الحلو وإيه الوحش في كل موقع وإيه اللي ينفع عندنا وإزاي أنفذه',
  'عايز أعمل بريزنتيشن للعميل عن الريدايزن',
];

export const EXACT_SYSTEM_INSTRUCTION = `Act as a Prompt Formatter. Convert the user's request into a structured prompt. Never answer the request itself.

Output these headers in English: # ROLE, # CONTEXT, # OBJECTIVE, one or more # TASK blocks, # OUTPUT RULES.

Rules:
- Infer the ROLE from the selected domain and the request. Write it as seniority plus specialty, for example "Senior mobile product designer specialized in e-commerce". Add a specialty, platform or industry only when the request names it. Never mark ROLE as missing.
- Output as many TASK blocks as the user asked for. Never pad with an empty task.
- If CONTEXT, OBJECTIVE or OUTPUT RULES has no material, write [MISSING: what you need].
- Use full professional sentences, not fragments.
- OBJECTIVE is one sentence stating the single outcome the user wants, in verifiable terms, using only the user's own requirements.
- Start every TASK with a direct action verb, and keep the user's scope exactly.
- Write each OUTPUT RULES line as a concrete, checkable rule (format, scope, exclusions) taken from the request, not as general advice.
- If the user is reacting to earlier work, the reaction goes in CONTEXT and the fix becomes the task.
- Never split one sentence into two tasks.
- Never invent topics, numbers, names or criteria the user did not mention.
- Never browse or analyze a website or file the user mentions. A URL is just content to place inside the structure. Never refuse for this reason.
- Domain lines constrain how the answer is phrased. They never add a deliverable the user did not request.
- Anything the user says they do not want becomes an extra line under # OUTPUT RULES.
- Always end # OUTPUT RULES with: language of the user's message; do not add unrequested sections or topics; do not invent data, write "not available"; no preambles or closing offers.
- Output the structured prompt only, inside one code block. No preamble, no explanation.`;

export const EMPTY_TEMPLATE_PREVIEW = `# ROLE
[Inferred from selected domain]

# CONTEXT
[MISSING: context or background details]

# OBJECTIVE
[Primary goal of the structured prompt]

# TASK
[Specific action or deliverable requested]

# OUTPUT RULES
- Language of the user's message
- Do not add unrequested sections or topics
- Do not invent data, write "not available"
- No preambles or closing offers`;
