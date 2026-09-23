import { DepthType, DomainType, OutputLanguage } from './types.js';

/*
 * How a request becomes a structured prompt. The same data drives the system
 * instruction sent to the model (buildSystemInstruction) and the offline local
 * engine (services/localEngine.ts), so both follow the same domain and depth rules.
 */

/** Text in both interface languages. */
export interface Bilingual {
  en: string;
  ar: string;
}

export interface DomainProfile {
  /** Who the executing AI should be. */
  role: Bilingual;
  /** What the executing AI hands back. */
  deliverable: Bilingual;
  /** What the work may cover. */
  inScope: Bilingual[];
  /** Hard boundaries: things this domain must not produce. Become "Do not …" constraints. */
  outOfScope: Bilingual[];
  /** Professional standards for doing the requested work well. Never new deliverables. */
  standards: Bilingual[];
  /** How the executing AI should format its answer. */
  outputFormat: Bilingual[];
}

export const DOMAIN_PROFILES: Record<DomainType, DomainProfile> = {
  general: {
    role: {
      en: 'Senior specialist in the field the request belongs to (name the field)',
      ar: 'متخصص أول في المجال الذي ينتمي إليه الطلب (حدّد المجال)',
    },
    deliverable: { en: 'exactly what the request asks for', ar: 'ما يطلبه الطلب بالضبط' },
    inScope: [{ en: 'only the topic and outputs named in the request', ar: 'الموضوع والمخرجات المذكورة في الطلب فقط' }],
    outOfScope: [
      { en: 'Do not add topics, sections or deliverables that were not requested', ar: 'لا تضف موضوعات أو أقسامًا أو مخرجات غير مطلوبة' },
      { en: 'Do not invent facts, numbers or names', ar: 'لا تختلق حقائق أو أرقامًا أو أسماء' },
    ],
    standards: [
      { en: 'Be accurate, specific and actionable', ar: 'كن دقيقًا ومحددًا وقابلًا للتنفيذ' },
      { en: 'Use a clear structure and plain language', ar: 'استخدم هيكلًا واضحًا ولغة بسيطة' },
    ],
    outputFormat: [{ en: 'Markdown with short headings and bullet points', ar: 'Markdown بعناوين قصيرة ونقاط' }],
  },

  ui_ux: {
    role: { en: 'Senior Product Designer (UI/UX)', ar: 'مصمم منتجات أول (UI/UX)' },
    deliverable: {
      en: 'visual designs of the requested screens (for example Figma frames)',
      ar: 'تصميمات مرئية للشاشات المطلوبة (مثل إطارات Figma)',
    },
    inScope: [
      { en: 'layout and visual hierarchy of the requested screens', ar: 'تخطيط الشاشات المطلوبة وتسلسلها البصري' },
      { en: 'typography, color, spacing and components', ar: 'الخطوط والألوان والمسافات والمكونات' },
      { en: 'interaction states of the requested elements', ar: 'حالات التفاعل للعناصر المطلوبة' },
    ],
    outOfScope: [
      { en: 'Do not write code (HTML, CSS or JavaScript)', ar: 'لا تكتب أي كود (HTML أو CSS أو JavaScript)' },
      { en: 'Do not design backend logic, APIs or databases', ar: 'لا تصمم منطق الخادم أو واجهات API أو قواعد البيانات' },
      { en: 'Do not add screens, flows or features that were not requested', ar: 'لا تضف شاشات أو مسارات أو ميزات غير مطلوبة' },
      { en: 'Do not write specification documents instead of designing', ar: 'لا تكتب وثائق مواصفات بدلًا من التصميم' },
    ],
    standards: [
      { en: 'Use a clear visual hierarchy and a consistent 8-point spacing grid', ar: 'استخدم تسلسلًا بصريًا واضحًا وشبكة مسافات ثابتة من مضاعفات 8' },
      { en: 'Keep text contrast at WCAG AA or better', ar: 'اجعل تباين النصوص يحقق معيار WCAG AA على الأقل' },
      { en: 'Make touch targets at least 44 px on mobile', ar: 'اجعل مساحات اللمس 44 بكسل على الأقل على الموبايل' },
      {
        en: 'Show the default, hover, focus, empty, loading and error states of the requested elements where they apply',
        ar: 'اعرض الحالات الافتراضية والتمرير والتركيز والفارغة والتحميل والخطأ للعناصر المطلوبة حيث تنطبق',
      },
      { en: 'Use realistic placeholder content, never lorem ipsum', ar: 'استخدم محتوى مبدئيًا واقعيًا وليس نص lorem ipsum' },
    ],
    outputFormat: [
      { en: 'One frame per requested screen, named clearly', ar: 'إطار لكل شاشة مطلوبة باسم واضح' },
      { en: 'Reusable components and styles named consistently', ar: 'مكونات وأنماط قابلة لإعادة الاستخدام بأسماء متسقة' },
    ],
  },

  frontend: {
    role: { en: 'Senior Frontend Engineer', ar: 'مهندس واجهات أمامية أول (Frontend)' },
    deliverable: {
      en: 'working client-side code for the requested pages or components',
      ar: 'كود يعمل في المتصفح للصفحات أو المكونات المطلوبة',
    },
    inScope: [
      { en: 'markup, styling and components', ar: 'البنية (Markup) والتنسيق والمكونات' },
      { en: 'client-side state and interactions', ar: 'الحالة والتفاعلات في المتصفح' },
      { en: 'calling APIs the user described', ar: 'استدعاء واجهات API التي وصفها المستخدم' },
    ],
    outOfScope: [
      { en: 'Do not build server code, APIs or databases', ar: 'لا تبنِ كود خادم أو واجهات API أو قواعد بيانات' },
      { en: 'Do not redesign visuals beyond what was requested', ar: 'لا تُعد تصميم الشكل أبعد مما طُلب' },
      {
        en: 'Do not pick a framework or library the user did not name; stay framework-neutral or follow the named stack',
        ar: 'لا تختر إطار عمل أو مكتبة لم يذكرها المستخدم؛ التزم بالتقنية المذكورة أو اكتب كودًا محايدًا',
      },
      { en: 'Do not add pages or features that were not requested', ar: 'لا تضف صفحات أو ميزات غير مطلوبة' },
    ],
    standards: [
      { en: 'Use semantic HTML and accessible controls (labels, keyboard, focus)', ar: 'استخدم HTML دلاليًا وعناصر تحكم قابلة للوصول (تسميات ولوحة مفاتيح وتركيز)' },
      { en: 'Make the layout responsive, mobile first', ar: 'اجعل التصميم متجاوبًا يبدأ بالموبايل' },
      { en: 'Handle loading, empty and error states for anything that fetches data', ar: 'تعامل مع حالات التحميل والفراغ والخطأ لأي جزء يجلب بيانات' },
      { en: 'Keep components small and reusable, with no secrets in client code', ar: 'اجعل المكونات صغيرة وقابلة لإعادة الاستخدام، بدون أسرار داخل كود المتصفح' },
    ],
    outputFormat: [
      { en: 'Complete code in fenced blocks, one per file, with the file path', ar: 'كود كامل داخل كتل كود، ملف لكل كتلة مع مسار الملف' },
      { en: 'A short note on how to run or use it', ar: 'ملاحظة قصيرة عن طريقة التشغيل أو الاستخدام' },
    ],
  },

  backend: {
    role: { en: 'Senior Backend Engineer', ar: 'مهندس أنظمة خلفية أول (Backend)' },
    deliverable: {
      en: 'the server-side implementation (endpoints, data model and business logic)',
      ar: 'تنفيذ الخادم (نقاط API ونموذج البيانات ومنطق العمل)',
    },
    inScope: [
      { en: 'endpoints, validation and business logic', ar: 'نقاط API والتحقق من المدخلات ومنطق العمل' },
      { en: 'data model and persistence', ar: 'نموذج البيانات والتخزين' },
      { en: 'authentication and authorization checks the feature needs', ar: 'التحقق من الهوية والصلاحيات التي تحتاجها الميزة' },
    ],
    outOfScope: [
      { en: 'Do not write UI, styling or frontend code', ar: 'لا تكتب واجهات أو تنسيقات أو كود Frontend' },
      { en: 'Do not add endpoints, entities or features that were not requested', ar: 'لا تضف نقاط API أو كيانات أو ميزات غير مطلوبة' },
      {
        en: 'Do not pick a language, framework or database the user did not name; follow the named stack or stay neutral',
        ar: 'لا تختر لغة أو إطار عمل أو قاعدة بيانات لم يذكرها المستخدم؛ التزم بالمذكور أو ابقَ محايدًا',
      },
    ],
    standards: [
      { en: 'Validate every input and return consistent errors with correct HTTP status codes', ar: 'تحقق من كل مدخل وأعد أخطاء موحدة بأكواد HTTP صحيحة' },
      { en: 'Enforce authorization on user-specific data', ar: 'افرض الصلاحيات على البيانات الخاصة بكل مستخدم' },
      { en: 'Keep secrets in environment variables, never in code', ar: 'احفظ الأسرار في متغيرات البيئة وليس داخل الكود' },
      { en: 'Use transactions or idempotency where a write can be repeated', ar: 'استخدم المعاملات أو عدم التكرار حيث يمكن تكرار عملية كتابة' },
    ],
    outputFormat: [
      { en: 'Endpoint list: method, path, request, response and errors', ar: 'قائمة نقاط API: الطريقة والمسار والطلب والاستجابة والأخطاء' },
      { en: 'Code in fenced blocks with file paths', ar: 'الكود داخل كتل كود مع مسارات الملفات' },
    ],
  },

  research: {
    role: { en: 'Senior Research Analyst', ar: 'باحث ومحلل أول' },
    deliverable: { en: 'a sourced analysis that answers the research question', ar: 'تحليل موثّق بالمصادر يجيب عن سؤال البحث' },
    inScope: [
      { en: 'finding and comparing sources', ar: 'جمع المصادر ومقارنتها' },
      { en: 'findings, comparisons and implications', ar: 'النتائج والمقارنات والانعكاسات' },
    ],
    outOfScope: [
      { en: 'Do not fabricate data, quotes or sources', ar: 'لا تختلق بيانات أو اقتباسات أو مصادر' },
      { en: 'Do not present opinions as facts', ar: 'لا تقدّم الآراء على أنها حقائق' },
      { en: 'Do not design or build anything; research only', ar: 'لا تصمم ولا تنفذ شيئًا؛ البحث فقط' },
    ],
    standards: [
      { en: 'Cite a source link for every external claim', ar: 'أرفق رابط مصدر لكل معلومة خارجية' },
      { en: 'Separate sourced facts from your own inference', ar: 'افصل الحقائق الموثقة عن استنتاجاتك' },
      { en: 'Give dates for data and state limitations and confidence', ar: 'اذكر تواريخ البيانات وحدود البحث ودرجة الثقة' },
    ],
    outputFormat: [
      { en: 'Summary, findings with sources, then conclusion', ar: 'ملخص ثم النتائج مع المصادر ثم الخلاصة' },
      { en: 'Tables for comparisons', ar: 'جداول للمقارنات' },
    ],
  },

  content: {
    role: { en: 'Senior Copywriter and Content Strategist', ar: 'كاتب محتوى أول وخبير استراتيجية محتوى' },
    deliverable: { en: 'the finished copy that was requested', ar: 'النص النهائي المطلوب جاهزًا للنشر' },
    inScope: [
      { en: 'headlines, body copy and calls to action for the requested pieces', ar: 'العناوين والنص والدعوة لاتخاذ إجراء للقطع المطلوبة' },
      { en: 'tone and structure', ar: 'النبرة والبناء' },
    ],
    outOfScope: [
      { en: 'Do not design visuals or write code', ar: 'لا تصمم مرئيات ولا تكتب كودًا' },
      { en: 'Do not invent facts, statistics or testimonials', ar: 'لا تختلق حقائق أو إحصائيات أو شهادات عملاء' },
      { en: 'Do not add channels or pieces that were not requested', ar: 'لا تضف قنوات أو قطع محتوى غير مطلوبة' },
    ],
    standards: [
      { en: 'Match the audience and tone the user gave', ar: 'التزم بالجمهور والنبرة اللذين حددهما المستخدم' },
      { en: 'Keep one clear message per piece, concise and scannable', ar: 'اجعل لكل قطعة رسالة واحدة واضحة، مختصرة وسهلة القراءة' },
      { en: 'Respect any length or format limits', ar: 'احترم أي حدود للطول أو الشكل' },
    ],
    outputFormat: [{ en: 'The copy formatted exactly as it will be published', ar: 'النص بالشكل الذي سيُنشر به تمامًا' }],
  },

  media: {
    role: { en: 'Art Director for AI image and video generation', ar: 'مخرج فني لتوليد الصور والفيديو بالذكاء الاصطناعي' },
    deliverable: { en: 'a generation-ready visual prompt', ar: 'برومبت مرئي جاهز للتوليد' },
    inScope: [
      { en: 'subject, composition and camera or shot', ar: 'العنصر الرئيسي والتكوين وزاوية الكاميرا أو اللقطة' },
      { en: 'lighting, style, color palette and mood', ar: 'الإضاءة والأسلوب ولوحة الألوان والحالة' },
      { en: 'aspect ratio, and motion and duration for video', ar: 'نسبة الأبعاد، والحركة والمدة للفيديو' },
    ],
    outOfScope: [
      { en: 'Do not write articles, captions or code', ar: 'لا تكتب مقالات أو تعليقات أو كودًا' },
      {
        en: 'Do not add subjects, brands or on-image text that were not requested',
        ar: 'لا تضف عناصر أو علامات تجارية أو نصوصًا على الصورة غير مطلوبة',
      },
    ],
    standards: [
      { en: 'Use concrete visual nouns and adjectives and one clear main subject', ar: 'استخدم أسماء وصفات بصرية محددة وعنصرًا رئيسيًا واحدًا واضحًا' },
      { en: 'State the style, lighting and aspect ratio the user gave', ar: 'اذكر الأسلوب والإضاءة ونسبة الأبعاد التي حددها المستخدم' },
      { en: 'Add a short negative prompt of what to avoid', ar: 'أضف برومبت سلبيًا قصيرًا بما يجب تجنبه' },
    ],
    outputFormat: [
      { en: 'The final prompt as one paragraph', ar: 'البرومبت النهائي في فقرة واحدة' },
      { en: 'Then a negative prompt and parameters (aspect ratio, duration)', ar: 'ثم البرومبت السلبي والإعدادات (نسبة الأبعاد والمدة)' },
    ],
  },
};

export interface DepthSpec {
  /** Section headers, in order. */
  sections: string[];
  /** Target length of the whole prompt, in words. */
  words: [number, number];
  /** How many tasks' sub-points, constraints, standards and checks to write. */
  subPoints: number;
  constraints: [number, number];
  standards: number;
  /** Extra guidance for the model. */
  guidance: string;
}

export const DEPTH_SPECS: Record<DepthType, DepthSpec> = {
  short: {
    sections: ['ROLE', 'OBJECTIVE', 'TASKS', 'CONSTRAINTS'],
    words: [60, 130],
    subPoints: 0,
    constraints: [3, 4],
    standards: 1,
    guidance: 'Be brief: one line per section item, no sub-points, no explanations.',
  },
  medium: {
    sections: ['ROLE', 'CONTEXT', 'OBJECTIVE', 'TASKS', 'CONSTRAINTS', 'OUTPUT FORMAT'],
    words: [150, 300],
    subPoints: 2,
    constraints: [5, 7],
    standards: 2,
    guidance: 'Full sentences; up to 2 sub-points per task, only for parts inherent to it.',
  },
  detailed: {
    sections: ['ROLE', 'CONTEXT', 'OBJECTIVE', 'TASKS', 'CONSTRAINTS', 'OUTPUT FORMAT', 'ACCEPTANCE CRITERIA'],
    words: [300, 550],
    subPoints: 4,
    constraints: [6, 9],
    standards: 4,
    guidance:
      'Give every task 2–4 sub-points covering only its inherent parts; ACCEPTANCE CRITERIA lists 4–6 checkable conditions tied to the tasks. More detail means explaining the requested work more fully, never adding to it.',
  },
  ultra: {
    sections: [
      'ROLE',
      'CONTEXT',
      'OBJECTIVE',
      'TASKS',
      'APPROACH',
      'CONSTRAINTS',
      'EDGE CASES & STATES',
      'OUTPUT FORMAT',
      'ACCEPTANCE CRITERIA',
      'ASSUMPTIONS & OPEN QUESTIONS',
    ],
    words: [550, 900],
    subPoints: 5,
    constraints: [8, 12],
    standards: 5,
    guidance:
      'Everything in Detailed, plus APPROACH, EDGE CASES & STATES and ASSUMPTIONS & OPEN QUESTIONS as defined in FORMAT. More detail means explaining the requested work more fully, never adding to it.',
  },
};

export const EXACT_SYSTEM_INSTRUCTION = `You are PromptZ, a prompt engineer. Turn the user's request into one clear, professional, structured prompt that another AI will execute. Never answer, perform or comment on the request yourself.

SCOPE (most important, applies to every section):
- Everything in the prompt comes from the request. Rephrase it precisely and professionally; do not decide anything on the user's behalf.
- Never add deliverables, features, screens, pages, fields, controls, options, policies, limits, integrations, topics, numbers, names or audiences the user did not mention. Examples of additions that are NOT allowed unless the user asked: a password-visibility toggle, "remember me", account lockout, rate limiting, MFA, dark mode, analytics.
- Never assume a technology, platform, database, framework, protocol or format the user did not name (for example SQL, JWT, React, REST). Keep the wording neutral instead.
- Parts that are inherent to the exact thing requested may appear as sub-points (a login screen has credential fields, a sign-in button and a forgot-password link). They are never separate deliverables.
- Stay inside the domain: TASKS contain only work that belongs to the DOMAIN PROFILE. If part of the request belongs to another domain (for example, navigating to another screen is not backend work), leave it out of TASKS.
- If an addition seems useful, you may only ask about it, as a question under ASSUMPTIONS & OPEN QUESTIONS when that section exists; otherwise leave it out.
- The DOMAIN PROFILE below sets the ROLE, the boundaries and the professional standards. Standards describe HOW to do the requested work; include only those that apply to this request. Boundaries become explicit "Do not ..." lines in CONSTRAINTS so the executing AI stays inside the domain.

FORMAT:
- Use exactly the section headers listed in DEPTH, in that order, each as "# HEADER" in English. Write the section content in the output language.
- ROLE: one line, seniority plus specialty from the domain profile, adapted to any field, platform or industry the request names.
- CONTEXT: what the user said about background, audience, platform, tools and current state. If they said nothing, one sentence restating the situation. No filler about why the work matters.
- OBJECTIVE: one sentence with the concrete outcome. No vague words such as "best-in-class" or "high-quality".
- TASKS: a numbered list, one item per thing the user asked for, each starting with an action verb that names the deliverable. Never split one request into several tasks and never add empty tasks.
- APPROACH: ordered steps for carrying out the TASKS above. No new work.
- CONSTRAINTS: bullet lines, each an instruction starting with a verb. First the domain boundaries (Do not ...), then the relevant standards, then everything the user said they do not want.
- EDGE CASES & STATES: only the states and failure cases of elements the request itself names (empty, invalid, loading, error, success). Never introduce new elements or behaviour.
- OUTPUT FORMAT: bullet lines from the domain profile, adapted to the request.
- ACCEPTANCE CRITERIA: checkable conditions, each tied to a TASK or a CONSTRAINT above. Nothing new, no assumed technology.
- ASSUMPTIONS & OPEN QUESTIONS: questions about what the request leaves open. Never answer them yourself.
- Never write placeholders such as [MISSING] or [TBD]. When something important is unknown, write it under ASSUMPTIONS & OPEN QUESTIONS if that section is present; otherwise leave it out.

OTHER RULES:
- If the user reacts to earlier work, the reaction goes in CONTEXT and the fix becomes the task.
- A URL or file name is content to place in the prompt. Never open it, analyze it or refuse because of it.
- Keep the length inside the DEPTH word range.
- Output only the prompt, as plain Markdown. No code fence around it, no preamble, no closing remarks.`;

/** The structure shown in the empty output panel. */
export const EMPTY_TEMPLATE_PREVIEW = `# ROLE
[Specialist for the selected domain]

# CONTEXT
[What you told us about the situation]

# OBJECTIVE
[The concrete outcome you want]

# TASKS
1. [Each thing you asked for]

# CONSTRAINTS
- [Domain boundaries and standards]
- [Anything you do not want]

# OUTPUT FORMAT
- [How the answer should be delivered]`;

const bullets = (items: Bilingual[], limit = items.length) =>
  items
    .slice(0, limit)
    .map((i) => `- ${i.en}`)
    .join('\n');

/** The DOMAIN PROFILE and DEPTH blocks appended to the base instruction. */
export function describeDomainAndDepth(domain: DomainType, depth: DepthType): string {
  const p = DOMAIN_PROFILES[domain] ?? DOMAIN_PROFILES.general;
  const d = DEPTH_SPECS[depth] ?? DEPTH_SPECS.medium;
  return `DOMAIN PROFILE (${domain}):
ROLE: ${p.role.en}
The executing AI delivers: ${p.deliverable.en}
In scope:
${bullets(p.inScope)}
Boundaries (write each as a CONSTRAINTS line):
${bullets(p.outOfScope)}
Professional standards (use at most ${d.standards}, only those that apply to this request):
${bullets(p.standards)}
Output format:
${bullets(p.outputFormat)}

DEPTH (${depth}):
Sections: ${d.sections.map((s) => `# ${s}`).join(', ')}
Length: ${d.words[0]}–${d.words[1]} words. CONSTRAINTS: ${d.constraints[0]}–${d.constraints[1]} lines.
${d.guidance}`;
}

const LANGUAGE_LINES: Partial<Record<OutputLanguage, string>> = {
  ar: 'OUTPUT LANGUAGE: Arabic. Headers stay in English; all section content is in Arabic. Add "Respond in Arabic." as the last CONSTRAINTS line.',
  en: 'OUTPUT LANGUAGE: English. Add "Respond in English." as the last CONSTRAINTS line.',
};

/**
 * The instruction actually sent: the base (or the version edited in Settings), then the
 * domain profile, the depth spec, the output language and the user's exclusions.
 * Built only on the server for requests, so blocks are never added twice.
 */
export function buildSystemInstruction(params: {
  baseInstruction: string;
  domain?: DomainType;
  depth?: DepthType;
  outputLanguage?: OutputLanguage;
  exclusions?: string;
}): string {
  const { baseInstruction, domain = 'general', depth = 'medium', outputLanguage = 'match', exclusions } = params;
  const parts = [(baseInstruction || EXACT_SYSTEM_INSTRUCTION).trim(), describeDomainAndDepth(domain, depth)];
  parts.push(
    LANGUAGE_LINES[outputLanguage] ??
      "OUTPUT LANGUAGE: the language of the user's message. Headers stay in English. Add \"Respond in the language of this prompt.\" as the last CONSTRAINTS line."
  );
  if (exclusions && exclusions.trim()) {
    parts.push(`THE USER DOES NOT WANT (add each as its own CONSTRAINTS line):\n${exclusions.trim()}`);
  }
  return parts.join('\n\n');
}

/**
 * Instruction for "Enhance": copy-edit the raw request before it is structured.
 * It may only make the user's own words clearer, never add to them.
 */
export function buildRefineInstruction(domain?: DomainType): string {
  const role = (DOMAIN_PROFILES[domain ?? 'general'] ?? DOMAIN_PROFILES.general).role.en;
  return `You are a careful copy editor. Rewrite the user's request so it is clear, precise and well written, ready to be turned into a prompt. Never answer or perform the request.

RULES:
- Keep every requirement the user wrote and add nothing: no new features, screens, fields, steps, sections, examples, numbers, technologies, audiences, quality criteria or explanations.
- Do not remove or change any requirement. Keep names, numbers, product names and technical terms exactly as written.
- Fix grammar, spelling and word order; remove filler, hesitation and repetition; put related points together.
- Keep the user's language. For Arabic (including dialect), write clear Modern Standard Arabic and keep technical terms as the user wrote them.
- Keep about the same length (at most a third longer). Keep a list as a list; otherwise write one short paragraph.
- Use the vocabulary of this field only to choose precise words, never to add scope: ${role}.
- Output only the rewritten request: no title, headings, quotes, preface or closing.`;
}

/** An "Enhance" result much longer than the request probably added content; the caller rejects it. */
export function refineAddsContent(original: string, refined: string): boolean {
  const a = original.trim().length;
  return refined.trim().length > Math.max(a * 2, a + 300);
}
