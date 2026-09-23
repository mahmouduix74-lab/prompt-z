import { DomainType, DepthType, OutputLanguage } from './types.js';

export interface DomainOption {
  id: DomainType;
  labelAr: string;
  labelEn: string;
  instructionLine: string;
}

// Domain lines set the ROLE base and domain-specific OUTPUT RULES only. They
// never add deliverables (see "Scope" in EXACT_SYSTEM_INSTRUCTION).
export const DOMAINS: DomainOption[] = [
  {
    id: 'general',
    labelAr: 'عام',
    labelEn: 'General',
    instructionLine: 'Domain: General. ROLE base: the specialist the request calls for.',
  },
  {
    id: 'ui_ux',
    labelAr: 'تصميم UI/UX',
    labelEn: 'UI/UX Design',
    instructionLine:
      'Domain: UI/UX Design. ROLE base: senior product designer. Word each TASK as the design to create (for example "Design the login screen in Figma"), never as a specification or document to write. OUTPUT RULES: deliver only the requested screens, with no specification, anatomy or extra pages; add a line asking for realistic images only if the design contains imagery such as product cards, banners or avatars. Replace "do not invent data, write "not available"" with "use realistic placeholder content".',
  },
  {
    id: 'frontend',
    labelAr: 'واجهات Frontend',
    labelEn: 'Frontend',
    instructionLine:
      'Domain: Frontend. ROLE base: senior frontend engineer. OUTPUT RULES: name a framework or library only if the user named it; no backend scope.',
  },
  {
    id: 'backend',
    labelAr: 'أنظمة Backend',
    labelEn: 'Backend',
    instructionLine:
      'Domain: Backend. ROLE base: senior backend engineer. OUTPUT RULES: name data models, endpoints and constraints only where the user mentioned them; no UI scope.',
  },
  {
    id: 'research',
    labelAr: 'بحث وتحليل',
    labelEn: 'Research',
    instructionLine:
      'Domain: Research. ROLE base: research analyst. OUTPUT RULES: cite a source link for every external claim; separate sourced facts from inference.',
  },
  {
    id: 'content',
    labelAr: 'كتابة محتوى',
    labelEn: 'Content',
    instructionLine:
      'Domain: Content. ROLE base: senior copywriter. OUTPUT RULES: state the audience and tone only if the user gave them; no technical scope.',
  },
  {
    id: 'media',
    labelAr: 'صور وفيديو',
    labelEn: 'Image/Video',
    instructionLine:
      'Domain: Image/Video. ROLE base: visual art director. OUTPUT RULES: describe subject, composition, lighting and style only where the user specified them.',
  },
];

export interface DepthOption {
  id: DepthType;
  labelAr: string;
  labelEn: string;
  instructionLine: string;
}

// Depth lines change the amount of detail only, never the scope.
export const DEPTHS: DepthOption[] = [
  {
    id: 'short',
    labelAr: 'موجز',
    labelEn: 'Short',
    instructionLine: 'Depth: Short. One or two sentences per section, no sub-points.',
  },
  {
    id: 'medium',
    labelAr: 'متوسط',
    labelEn: 'Medium',
    instructionLine: 'Depth: Medium. Full sentences in every section; sub-points only where the Scope rule allows them.',
  },
  {
    id: 'detailed',
    labelAr: 'مفصل',
    labelEn: 'Detailed',
    instructionLine:
      'Depth: Detailed. Expand every section and give each task sub-points, drawn only from the request and the inherent parts of what it asks for.',
  },
  {
    id: 'ultra',
    labelAr: 'شامل',
    labelEn: 'Ultra',
    instructionLine:
      'Depth: Ultra. As Detailed, and state every requirement and constraint the user gave explicitly and precisely. Never add new ones.',
  },
];

export interface OutputLanguageOption {
  id: OutputLanguage;
  labelAr: string;
  labelEn: string;
  // No line for "match": the base instruction already follows the language of the user's message.
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
      'Output language: Arabic. Write the section content in Arabic (headers stay in English) and use "Respond in Arabic" as the language line in OUTPUT RULES.',
  },
  {
    id: 'en',
    labelAr: 'الإنجليزية',
    labelEn: 'English',
    instructionLine:
      'Output language: English. Write the section content in English and use "Respond in English" as the language line in OUTPUT RULES.',
  },
];

// Requests used while tuning the formatter; clicking one fills the textarea.
export const STARTER_EXAMPLES: string[] = [
  'التقرير طويل أوي، عايزه أبسط وبالذات جزء تحليل المنافسين',
  'عايز أعرف مين المنافسين وإيه الحلو وإيه الوحش في كل موقع وإيه اللي ينفع عندنا وإزاي أنفذه',
  'عايز أعمل بريزنتيشن للعميل عن الريدايزن',
];

/** The OpenRouter model every generation and refine request uses. */
export const OPENROUTER_MODEL = 'google/gemini-2.0-flash-001';

export const EXACT_SYSTEM_INSTRUCTION = `Act as a Prompt Formatter. Rewrite the user's request as a structured prompt that another AI or tool will execute. Never answer or perform the request yourself.

Output exactly these headers, in English and in this order: # ROLE, # CONTEXT, # OBJECTIVE, one or more # TASK blocks, # OUTPUT RULES. Write the section content in the language of the user's message unless a language line below says otherwise.

Scope (the most important rule):
- Everything in the prompt comes from the request. Rephrase it in precise, professional language. Never add topics, features, screens, numbers, names, audiences or criteria the user did not mention.
- One exception: parts that are inherent to the exact thing requested may appear as sub-points (for example, a login screen has credential fields, a sign-in button, and forgot-password and sign-up links). Never add separate deliverables, pages, flows or documents.

Sections:
- ROLE: seniority plus specialty, built from the domain line and any field, platform or industry the request names. Never write [MISSING] here.
- CONTEXT: full sentences gathering what the user said about background, audience, platform, tools and constraints. No filler about why the work matters.
- OBJECTIVE: one sentence stating the outcome the user wants in concrete terms. No vague words such as "standard", "essential" or "best-in-class".
- TASK: one block per thing the user asked for. Never split one sentence into two tasks and never add an empty task. Start with an action verb that names the deliverable and, when given, the tool or platform. Add sub-points only when the request lists several parts or a part is inherent (see Scope).
- OUTPUT RULES: short, checkable lines taken from the request: scope limits, format, tool or platform conventions, and everything the user does not want. Then end with these four lines: Respond in the language of the user's message; Do not add unrequested sections or topics; Do not invent data, write "not available"; No preambles or closing offers.
- If CONTEXT or OBJECTIVE has nothing usable in the request, write [MISSING: what you need] instead of guessing.

Other rules:
- If the user is reacting to earlier work, the reaction goes in CONTEXT and the fix becomes the task.
- A URL or file name is content to place in the structure. Never browse it, analyze it or refuse because of it.
- The domain, depth and language lines below adjust wording, detail and domain-specific OUTPUT RULES only. They never add deliverables. When one of them names a replacement for an OUTPUT RULES line, use the replacement.
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
- Respond in the language of the user's message
- Do not add unrequested sections or topics
- Do not invent data, write "not available"
- No preambles or closing offers`;

/**
 * The instruction actually sent: the base (or the version edited in Settings)
 * plus one line each for domain, depth and output language, then exclusions.
 * Built only on the server for requests, so lines are never added twice.
 */
export function buildSystemInstruction(params: {
  baseInstruction: string;
  domain?: DomainType;
  depth?: DepthType;
  outputLanguage?: OutputLanguage;
  exclusions?: string;
}): string {
  const { baseInstruction, domain, depth, outputLanguage, exclusions } = params;
  const domainOption = DOMAINS.find((d) => d.id === domain) || DOMAINS[0];
  const depthOption = DEPTHS.find((d) => d.id === depth) || DEPTHS[1];
  const languageOption = OUTPUT_LANGUAGES.find((l) => l.id === outputLanguage);

  let instruction = `${(baseInstruction || EXACT_SYSTEM_INSTRUCTION).trim()}\n\n${domainOption.instructionLine}\n${depthOption.instructionLine}`;
  if (languageOption?.instructionLine) {
    instruction += `\n${languageOption.instructionLine}`;
  }
  if (exclusions && exclusions.trim()) {
    instruction += `\nThe user does not want the following; add each as its own line in OUTPUT RULES:\n${exclusions.trim()}`;
  }
  return instruction;
}
