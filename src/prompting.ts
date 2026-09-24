import { DepthType, DomainType, OutputLanguage } from './types.js';

/*
 * How a request becomes a structured prompt, in two steps:
 * 1. The model extracts what the user asked for as a JSON brief (buildSystemInstruction, parseBrief).
 * 2. Code composes the prompt from the brief and the domain and depth rules (composePrompt).
 * The offline engine (services/localEngine.ts) uses the same composer with a brief built from the
 * raw request, so both paths always have the same structure.
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
  /**
   * Boundaries the executing AI could really cross (becoming CONSTRAINTS lines). Obvious ones
   * a specialist would never cross (a designer writing backend code) are left out as noise.
   */
  outOfScope: Bilingual[];
  /** For the extractor: work that belongs to other domains, so it goes to outOfDomain. */
  otherDomains: string;
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
    otherDomains: 'none: every part of the request belongs here',
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
      { en: 'Deliver visual designs only, not code or written specifications', ar: 'سلّم تصميمات مرئية فقط، وليس كودًا أو مواصفات مكتوبة' },
      { en: 'Do not add screens, flows or features that were not requested', ar: 'لا تضف شاشات أو مسارات أو ميزات غير مطلوبة' },
    ],
    otherDomains: 'server logic, APIs, databases and code. Every element shown on a requested screen (fields, buttons, links) is part of the design, not another domain',
    standards: [
      { en: 'Use a clear visual hierarchy and a consistent 8-point spacing grid', ar: 'استخدم تسلسلًا بصريًا واضحًا وشبكة مسافات ثابتة من مضاعفات 8' },
      {
        en: 'Show the default, hover, focus, empty, loading and error states of the requested elements where they apply',
        ar: 'اعرض الحالات الافتراضية والتمرير والتركيز والفارغة والتحميل والخطأ للعناصر المطلوبة حيث تنطبق',
      },
      { en: 'Keep text contrast at WCAG AA or better', ar: 'اجعل تباين النصوص يحقق معيار WCAG AA على الأقل' },
      { en: 'Make touch targets at least 44 px on mobile', ar: 'اجعل مساحات اللمس 44 بكسل على الأقل على الموبايل' },
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
    otherDomains: 'server code, APIs and databases. Every element shown on a requested page (fields, buttons, links) is part of the page',
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
    otherDomains: 'screens, layout, styling, and links or navigation between pages (a "sign-up link" is frontend navigation, not a registration endpoint)',
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
    ],
    otherDomains: 'designing or building anything',
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
      { en: 'Do not invent facts, statistics or testimonials', ar: 'لا تختلق حقائق أو إحصائيات أو شهادات عملاء' },
      { en: 'Do not add channels or pieces that were not requested', ar: 'لا تضف قنوات أو قطع محتوى غير مطلوبة' },
    ],
    otherDomains: 'visual design and code',
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
      {
        en: 'Do not add subjects, brands or on-image text that were not requested',
        ar: 'لا تضف عناصر أو علامات تجارية أو نصوصًا على الصورة غير مطلوبة',
      },
    ],
    otherDomains: 'articles, captions and code',
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

/** The steps of the APPROACH section (Ultra). They order the requested work and never add to it. */
export const DOMAIN_APPROACH: Record<DomainType, Bilingual[]> = {
  general: [
    { en: 'Pin down exactly what the request asks for', ar: 'حدّد بالضبط ما يطلبه الطلب' },
    { en: 'Carry out the tasks in order', ar: 'نفّذ المهام بالترتيب' },
    { en: 'Check the result against the constraints and acceptance criteria', ar: 'راجع الناتج مقابل القيود ومعايير القبول' },
  ],
  ui_ux: [
    { en: 'List the requested screens and the elements on each', ar: 'حدّد الشاشات المطلوبة والعناصر في كل شاشة' },
    { en: 'Set the layout and visual hierarchy', ar: 'ضع التخطيط والتسلسل البصري' },
    { en: 'Apply typography, color, spacing and components', ar: 'طبّق الخطوط والألوان والمسافات والمكونات' },
    { en: 'Design the states of the requested elements', ar: 'صمّم حالات العناصر المطلوبة' },
    { en: 'Review the frames against the acceptance criteria', ar: 'راجع الإطارات مقابل معايير القبول' },
  ],
  frontend: [
    { en: 'List the requested pages or components and the data they use', ar: 'حدّد الصفحات أو المكونات المطلوبة والبيانات التي تستخدمها' },
    { en: 'Build the markup and component structure', ar: 'ابنِ البنية (Markup) وهيكل المكونات' },
    { en: 'Add the styling and responsive layout', ar: 'أضف التنسيق والتخطيط المتجاوب' },
    { en: 'Wire up the interactions and data states', ar: 'اربط التفاعلات وحالات البيانات' },
    { en: 'Test in the browser against the acceptance criteria', ar: 'اختبر في المتصفح مقابل معايير القبول' },
  ],
  backend: [
    { en: 'Define the data the requested features need', ar: 'حدّد البيانات التي تحتاجها الميزات المطلوبة' },
    { en: 'Specify the requested endpoints: input, output and errors', ar: 'حدّد نقاط API المطلوبة: المدخلات والمخرجات والأخطاء' },
    { en: 'Implement validation and business logic', ar: 'نفّذ التحقق من المدخلات ومنطق العمل' },
    { en: 'Apply the authorization checks the requested features need', ar: 'طبّق فحوص الصلاحيات التي تحتاجها الميزات المطلوبة' },
    { en: 'Test the success and error paths', ar: 'اختبر مسارات النجاح والخطأ' },
  ],
  research: [
    { en: 'Pin down the research question and its limits', ar: 'حدّد سؤال البحث وحدوده' },
    { en: 'Collect and vet sources', ar: 'اجمع المصادر وتحقق منها' },
    { en: 'Compare the findings', ar: 'قارن النتائج' },
    { en: 'Write the conclusion with its limitations and confidence', ar: 'اكتب الخلاصة مع حدودها ودرجة الثقة' },
  ],
  content: [
    { en: 'Confirm the audience, tone and length', ar: 'تأكد من الجمهور والنبرة والطول' },
    { en: 'Draft the requested pieces', ar: 'اكتب مسودة القطع المطلوبة' },
    { en: 'Edit for clarity and brevity', ar: 'حرّر النص ليكون واضحًا ومختصرًا' },
    { en: 'Check the copy against the constraints', ar: 'راجع النص مقابل القيود' },
  ],
  media: [
    { en: 'Fix the main subject', ar: 'حدّد العنصر الرئيسي' },
    { en: 'Set the composition and camera or shot', ar: 'حدّد التكوين وزاوية الكاميرا أو اللقطة' },
    { en: 'Describe lighting, style, palette and mood', ar: 'صف الإضاءة والأسلوب والألوان والحالة' },
    { en: 'Add the parameters and the negative prompt', ar: 'أضف الإعدادات والبرومبت السلبي' },
  ],
};

export interface DepthSpec {
  /** Section headers, in order. */
  sections: string[];
  /**
   * Most parts per task beyond the ones the user named: pieces the deliverable cannot exist without.
   * Parts the user named are never capped by depth, so nothing requested is dropped.
   */
  inherentParts: number;
  /** How many professional standards go into CONSTRAINTS, after the domain boundaries. */
  standards: number;
}

export const DEPTH_SPECS: Record<DepthType, DepthSpec> = {
  short: {
    sections: ['ROLE', 'OBJECTIVE', 'TASKS', 'CONSTRAINTS'],
    inherentParts: 0,
    standards: 1,
  },
  medium: {
    sections: ['ROLE', 'CONTEXT', 'OBJECTIVE', 'TASKS', 'CONSTRAINTS', 'OUTPUT FORMAT'],
    inherentParts: 2,
    standards: 2,
  },
  detailed: {
    sections: ['ROLE', 'CONTEXT', 'OBJECTIVE', 'TASKS', 'CONSTRAINTS', 'OUTPUT FORMAT', 'ACCEPTANCE CRITERIA'],
    inherentParts: 4,
    standards: 4,
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
    inherentParts: 5,
    standards: 5,
  },
};

/**
 * What the model extracts from a request. Only the user's own content lives here; the role,
 * boundaries, standards, format and acceptance criteria are added by composePrompt.
 */
export interface PromptBrief {
  focus: string;
  context: string;
  objective: string;
  tasks: { task: string; parts: string[] }[];
  outOfDomain: string[];
  userConstraints: string[];
  edgeCases: string[];
  openQuestions: string[];
}

/**
 * Step 1 of generation: the model reads the request and returns a PromptBrief as JSON.
 * Step 2 (composePrompt) is code, so the structure, boundaries and standards never vary.
 */
export const EXACT_SYSTEM_INSTRUCTION = `You are PromptZ's request analyst. Read the user's request and extract, as JSON, exactly what they asked for. PromptZ's code turns your JSON into the final prompt and adds the role, domain boundaries, professional standards and output format itself, so never write those. Never answer, perform or comment on the request.

Return one JSON object and nothing else (no code fence, no text before or after it), with these keys:
{
  "focus": "the specific subject in 2-6 words",
  "context": "background the user gave (audience, platform, tools, current state), or \\"\\" if none",
  "objective": "one sentence: the concrete outcome the user wants",
  "tasks": [{ "task": "an action verb plus one deliverable the user asked for", "parts": ["a part of that deliverable"] }],
  "outOfDomain": ["a part of the request that belongs to another domain"],
  "userConstraints": ["a requirement or limit the user stated"],
  "edgeCases": ["a state or failure case of an element the user named"],
  "openQuestions": ["a question about something the request leaves open"]
}

RULES:
- Use only what the user wrote. Rephrase it precisely and professionally, but never add features, fields, screens, endpoints, options, policies, rules, limits, numbers, names, technologies or audiences they did not mention, and never decide anything for them.
- tasks: one per deliverable the user asked for that belongs to the DOMAIN below. Never split one deliverable into several tasks. Quality work (validation, security, accessibility, performance, testing) is never a task; the code adds it as standards.
- parts: every element the user named for that deliverable (never drop one), plus, only where LIMITS allows, pieces the deliverable cannot exist without (a login screen needs a sign-in button). Never optional extras.
- outOfDomain: only parts of the request that the DOMAIN below says belong to other domains. They never become tasks. Everything else the user named stays in tasks or parts; never drop it.
- userConstraints: only requirements the user stated (technology, tone, length, style, platform). Never professional standards of your own.
- edgeCases: only states of elements the user named (empty, invalid, loading, error, success).
- An idea the user did not ask for may appear only as a question in openQuestions. Never answer the questions.
- The examples in these instructions are for you only. Never copy them into the JSON.
- A URL or file name is content: keep it as written. Never open it or refuse because of it.
- If the user reacts to earlier work, put the reaction in context and the fix in tasks.
- Use [] or "" when there is nothing. Never write placeholders such as [TBD].`;

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

const bullets = (items: Bilingual[]) => items.map((i) => `- ${i.en}`).join('\n');

/** The domain and the limits of the chosen depth, appended to the extraction instruction. */
export function describeDomainAndDepth(domain: DomainType, depth: DepthType): string {
  const p = DOMAIN_PROFILES[domain] ?? DOMAIN_PROFILES.general;
  const d = DEPTH_SPECS[depth] ?? DEPTH_SPECS.medium;
  const ultra = d.sections.includes('EDGE CASES & STATES');
  return `DOMAIN (${domain}): the prompt is for a ${p.role.en}, who delivers ${p.deliverable.en}.
In this domain:
${bullets(p.inScope)}
Belongs to other domains (such parts of the request go to outOfDomain): ${p.otherDomains}.

LIMITS (${depth}):
- parts: every element the user named, ${d.inherentParts ? `plus at most ${d.inherentParts} pieces the deliverable cannot exist without` : 'and nothing else'}
- edgeCases and openQuestions: ${ultra ? 'at most 5 each' : 'always []'}`;
}

/**
 * The language a request is written in. Arabic wins when Arabic letters are a fair share of the
 * letters, so mixed requests such as "عايز landing page لتطبيق توصيل" count as Arabic.
 */
export function detectRequestLanguage(text: string): 'ar' | 'en' {
  const arabic = (text.match(/[؀-ۿ]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return arabic > 0 && arabic >= latin * 0.4 ? 'ar' : 'en';
}

/** "Match my request" resolved to the request's actual language, so the model is told it by name. */
export function resolveOutputLanguage(outputLanguage: OutputLanguage | undefined, requestText: string): 'ar' | 'en' {
  return outputLanguage === 'ar' || outputLanguage === 'en' ? outputLanguage : detectRequestLanguage(requestText);
}

const LANGUAGE_LINES: Record<'ar' | 'en', string> = {
  ar: 'LANGUAGE: write every JSON string value in Arabic (clear Modern Standard Arabic), even though these instructions are in English. Keep the JSON keys, code, file names, product names and technical terms as written.',
  en: 'LANGUAGE: write every JSON string value in English. Keep the JSON keys, code, file names and product names as written.',
};

/** The user's "things I don't want", one per line. */
function exclusionLines(exclusions?: string): string[] {
  return (exclusions || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\s]+/, '').trim())
    .filter(Boolean);
}

/**
 * The extraction instruction actually sent: the base (or the version edited in Settings), then
 * the domain, the depth limits, the language of the values and the user's exclusions.
 * Built only on the server for requests, so blocks are never added twice.
 */
export function buildSystemInstruction(params: {
  baseInstruction: string;
  domain?: DomainType;
  depth?: DepthType;
  outputLanguage?: OutputLanguage;
  exclusions?: string;
  /** The user's request; "Match my request" is resolved from it. */
  requestText?: string;
}): string {
  const { baseInstruction, domain = 'general', depth = 'medium', outputLanguage = 'match', exclusions, requestText = '' } = params;
  const parts = [(baseInstruction || EXACT_SYSTEM_INSTRUCTION).trim(), describeDomainAndDepth(domain, depth)];
  parts.push(LANGUAGE_LINES[resolveOutputLanguage(outputLanguage, requestText)]);
  const excluded = exclusionLines(exclusions);
  if (excluded.length) {
    parts.push(`THE USER DOES NOT WANT (keep these out of tasks and parts):\n${excluded.map((e) => `- ${e}`).join('\n')}`);
  }
  return parts.join('\n\n');
}

const MAX_TASKS = 8;
const MAX_ITEMS = 6;
const MAX_PARTS = 10;
const MAX_TEXT = 400;

/**
 * Reads the model's JSON brief. Tolerates a code fence or stray text around the object and caps
 * every list. Returns null when there is no usable brief (no JSON, or no tasks).
 */
export function parseBrief(text: string): PromptBrief | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  let data: any;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const str = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) : '');
  const strs = (v: unknown, limit = MAX_ITEMS) => (Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, limit) : []);

  const tasks = (Array.isArray(data.tasks) ? data.tasks : [])
    .map((t: any) => (typeof t === 'string' ? { task: str(t), parts: [] } : { task: str(t?.task), parts: strs(t?.parts, MAX_PARTS) }))
    .filter((t: { task: string }) => t.task)
    .slice(0, MAX_TASKS);
  if (!tasks.length) return null;

  return {
    focus: str(data.focus),
    context: str(data.context),
    objective: str(data.objective),
    tasks,
    outOfDomain: strs(data.outOfDomain),
    userConstraints: strs(data.userConstraints),
    edgeCases: strs(data.edgeCases),
    openQuestions: strs(data.openQuestions),
  };
}

/** A brief built from the raw request alone, for the offline engine. */
export function localBrief(rawText: string, domain: DomainType, language: 'ar' | 'en', depth: DepthType = 'medium'): PromptBrief {
  const ar = language === 'ar';
  const profile = DOMAIN_PROFILES[domain] ?? DOMAIN_PROFILES.general;
  const t = (text: Bilingual) => (ar ? text.ar : text.en);
  const quoted = `"${rawText.trim()}"`;
  return {
    focus: '',
    context: ar ? `طلب المستخدم كما كتبه: ${quoted}.` : `The user's request, as written: ${quoted}.`,
    objective: ar
      ? `تسليم ${t(profile.deliverable)} بما يحقق الطلب بالضبط، دون أي إضافات.`
      : `Deliver ${t(profile.deliverable)} that fulfils the request exactly, with nothing added.`,
    tasks: [
      {
        task: ar ? `سلّم ${t(profile.deliverable)} للطلب: ${quoted}` : `Deliver ${t(profile.deliverable)} for: ${quoted}`,
        parts: profile.inScope.slice(0, (DEPTH_SPECS[depth] ?? DEPTH_SPECS.medium).inherentParts).map(t),
      },
    ],
    outOfDomain: [],
    userConstraints: [],
    edgeCases: ar
      ? ['المدخلات الناقصة أو غير الصحيحة', 'الحالات الفارغة وحالات الخطأ حيث ينطبق ذلك']
      : ['Missing or invalid input', 'Empty and error states where they apply'],
    openQuestions: ar
      ? ['ما المنصة أو الأداة المستهدفة؟', 'من الجمهور المستهدف؟', 'هل توجد أمثلة أو مراجع يجب الالتزام بها؟']
      : ['Which platform or tool is this for?', 'Who is the audience?', 'Are there examples or references to follow?'],
  };
}

/**
 * Step 2 of generation: builds the final prompt from a brief. The sections come from the depth;
 * the role, boundaries, standards, approach and output format from the domain profile; the rest
 * only from the brief, so nothing the user did not ask for can appear as work.
 */
export function composePrompt(params: {
  brief: PromptBrief;
  domain?: DomainType;
  depth?: DepthType;
  language: 'ar' | 'en';
  exclusions?: string;
}): string {
  const { brief, domain = 'general', depth = 'medium', language } = params;
  const ar = language === 'ar';
  const t = (text: Bilingual) => (ar ? text.ar : text.en);
  const list = (items: string[]) => items.map((i) => `- ${i}`).join('\n');
  const profile = DOMAIN_PROFILES[domain] ?? DOMAIN_PROFILES.general;
  const spec = DEPTH_SPECS[depth] ?? DEPTH_SPECS.medium;
  const plain = (s: string) => s.replace(/[.،؛;:!?؟]+$/u, '');

  let role = t(profile.role);
  if (brief.focus) {
    role = domain === 'general' ? (ar ? `متخصص أول في ${brief.focus}` : `Senior specialist in ${brief.focus}`) : `${role} — ${brief.focus}`;
  }

  const outOfDomain = brief.outOfDomain.length
    ? `\n${ar ? 'خارج نطاق هذه المهمة' : 'Outside the scope of this task'}: ${brief.outOfDomain.map(plain).join(ar ? '، ' : '; ')}.`
    : '';
  const context =
    (brief.context ||
      (ar
        ? 'لم يذكر المستخدم تفاصيل إضافية عن الجمهور أو المنصة أو الأدوات.'
        : 'The user gave no further details about audience, platform or tools.')) + outOfDomain;

  const tasks = brief.tasks
    .map((task, i) => {
      const parts = task.parts.slice(0, MAX_PARTS);
      return `${i + 1}. ${task.task}${parts.length ? `\n${parts.map((p) => `   - ${p}`).join('\n')}` : ''}`;
    })
    .join('\n');

  const constraints = [
    ...[...profile.outOfScope, ...profile.standards.slice(0, spec.standards)].map(t),
    ...brief.userConstraints,
    ...exclusionLines(params.exclusions).map((e) => (ar ? `المستخدم لا يريد: ${plain(e)}` : `The user does not want: ${plain(e)}`)),
    ar ? 'اكتب الرد بالعربية.' : 'Respond in English.',
  ];

  const acceptance = [
    ...brief.tasks.map((task, i) => (ar ? `المهمة ${i + 1} مكتملة: ${plain(task.task)}` : `Task ${i + 1} is complete: ${plain(task.task)}`)),
    ar ? 'لا يوجد في الناتج شيء خارج المهام أعلاه' : 'Nothing outside the tasks above was added',
    ar ? 'كل القيود أعلاه محترمة' : 'Every constraint above is respected',
  ];

  const sections: Record<string, string> = {
    ROLE: role,
    CONTEXT: context,
    OBJECTIVE:
      brief.objective ||
      (ar ? `تسليم ${t(profile.deliverable)} بما يحقق الطلب بالضبط.` : `Deliver ${t(profile.deliverable)} that fulfils the request exactly.`),
    TASKS: tasks,
    APPROACH: (DOMAIN_APPROACH[domain] ?? DOMAIN_APPROACH.general).map((step, i) => `${i + 1}. ${t(step)}`).join('\n'),
    CONSTRAINTS: list(constraints),
    'EDGE CASES & STATES': list(brief.edgeCases),
    'OUTPUT FORMAT': list(profile.outputFormat.map(t)),
    'ACCEPTANCE CRITERIA': list(acceptance),
    'ASSUMPTIONS & OPEN QUESTIONS': list(brief.openQuestions),
  };

  // Sections the brief left empty (no edge cases, no open questions) are left out, never padded.
  return spec.sections
    .filter((name) => sections[name])
    .map((name) => `# ${name}\n${sections[name]}`)
    .join('\n\n');
}

/**
 * Instruction for "Enhance": copy-edit the raw request before it is structured.
 * It may only make the user's own words clearer, never add to them.
 */
export function buildRefineInstruction(domain?: DomainType, requestText = ''): string {
  const role = (DOMAIN_PROFILES[domain ?? 'general'] ?? DOMAIN_PROFILES.general).role.en;
  const language =
    detectRequestLanguage(requestText) === 'ar'
      ? 'The request is in Arabic: write the rewrite in Arabic (clear Modern Standard Arabic), never in English.'
      : 'The request is in English: write the rewrite in English.';
  return `You are a careful copy editor. Rewrite the user's request so it is clear, precise and well written, ready to be turned into a prompt. Never answer or perform the request.

RULES:
- Keep every requirement the user wrote and add nothing: no new features, screens, fields, steps, sections, examples, numbers, technologies, audiences, quality criteria or explanations.
- Do not remove or change any requirement. Keep names, numbers, product names and technical terms exactly as written.
- Fix grammar, spelling and word order; remove filler, hesitation and repetition; put related points together.
- Keep the user's language. For Arabic (including dialect), write clear Modern Standard Arabic and keep technical terms as the user wrote them.
- Keep about the same length (at most a third longer). Keep a list as a list; otherwise write one short paragraph.
- Use the vocabulary of this field only to choose precise words, never to add scope: ${role}.
- ${language}
- Output only the rewritten request: no title, headings, quotes, preface or closing.`;
}

/** An "Enhance" result much longer than the request probably added content; the caller rejects it. */
export function refineAddsContent(original: string, refined: string): boolean {
  const a = original.trim().length;
  return refined.trim().length > Math.max(a * 2, a + 300);
}
