import { DepthType, DomainType, OutputLanguage } from './types.js';

/*
 * How a request becomes a structured prompt, in two steps:
 * 1. The model reads the request and plans the prompt as a JSON brief (buildSystemInstruction,
 *    parseBrief): the kind of answer, the role, tasks, constraints, format and the rest, all taken
 *    from the request. The domain only says whose expertise answers it.
 * 2. Code lays the brief out in the sections of the chosen depth (composePrompt).
 * The offline engine (services/localEngine.ts) uses the same composer with a brief built from the
 * raw request, so both paths always have the same structure.
 */

/** Text in both interface languages. */
export interface Bilingual {
  en: string;
  ar: string;
}

/**
 * A domain is expertise, not a template: the model uses it to pick the role and, only when the
 * request asks for something to be created, as a source of candidate standards and formats.
 */
export interface DomainProfile {
  /** Who the executing AI should be. */
  role: Bilingual;
  /** What the executing AI hands back when it creates something. */
  deliverable: Bilingual;
  /** What the work may cover. */
  inScope: Bilingual[];
  /** Boundaries worth stating when creating (candidates only, never added to every prompt). */
  outOfScope: Bilingual[];
  /** For the extractor: work that belongs to other domains, so it goes to outOfDomain. */
  otherDomains: string;
  /** Professional standards for creating the domain's work (candidates, used only where they apply). */
  standards: Bilingual[];
  /** Typical formats when creating (candidates). */
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

  mobile: {
    role: { en: 'Senior Mobile App Engineer', ar: 'مهندس تطبيقات موبايل أول' },
    deliverable: { en: 'working mobile app code for the requested screens or features', ar: 'كود تطبيق موبايل يعمل للشاشات أو الميزات المطلوبة' },
    inScope: [
      { en: 'screens, navigation and components', ar: 'الشاشات والتنقل والمكونات' },
      { en: 'device features, permissions and offline behaviour the request names', ar: 'ميزات الجهاز والصلاحيات والعمل دون اتصال التي يذكرها الطلب' },
    ],
    outOfScope: [
      { en: 'Do not pick a platform or framework the user did not name', ar: 'لا تختر منصة أو إطار عمل لم يذكره المستخدم' },
      { en: 'Do not add screens or features that were not requested', ar: 'لا تضف شاشات أو ميزات غير مطلوبة' },
    ],
    otherDomains: 'server code, APIs and databases. Every element on a requested screen is part of the app',
    standards: [
      { en: 'Follow the platform guidelines (Human Interface Guidelines, Material)', ar: 'اتبع إرشادات المنصة (Human Interface Guidelines وMaterial)' },
      { en: 'Handle loading, empty, error and offline states', ar: 'تعامل مع حالات التحميل والفراغ والخطأ وانقطاع الاتصال' },
      { en: 'Keep touch targets at least 44 pt and support dynamic text size', ar: 'اجعل مساحات اللمس 44 نقطة على الأقل وادعم تكبير النص' },
      { en: 'Ask for permissions only when the feature needs them', ar: 'اطلب الصلاحيات فقط عندما تحتاجها الميزة' },
    ],
    outputFormat: [
      { en: 'Complete code in fenced blocks, one per file, with the file path', ar: 'كود كامل داخل كتل كود، ملف لكل كتلة مع مسار الملف' },
      { en: 'A short note on how to run it', ar: 'ملاحظة قصيرة عن طريقة التشغيل' },
    ],
  },

  devops: {
    role: { en: 'Senior DevOps and Cloud Engineer', ar: 'مهندس DevOps وسحابة أول' },
    deliverable: { en: 'the requested infrastructure, pipeline or deployment setup', ar: 'البنية التحتية أو خط النشر أو إعداد النشر المطلوب' },
    inScope: [
      { en: 'CI/CD pipelines, containers and deployment', ar: 'خطوط CI/CD والحاويات والنشر' },
      { en: 'cloud resources, configuration, monitoring and security settings', ar: 'موارد السحابة والإعدادات والمراقبة وإعدادات الأمان' },
    ],
    outOfScope: [
      { en: 'Do not pick a cloud provider or tool the user did not name', ar: 'لا تختر مزود سحابة أو أداة لم يذكرها المستخدم' },
      { en: 'Do not add services or environments that were not requested', ar: 'لا تضف خدمات أو بيئات غير مطلوبة' },
    ],
    otherDomains: 'application features, UI and business logic',
    standards: [
      { en: 'Keep secrets in a secret store, never in files or logs', ar: 'احفظ الأسرار في مخزن أسرار، وليس في الملفات أو السجلات' },
      { en: 'Make every step repeatable and version-controlled', ar: 'اجعل كل خطوة قابلة للتكرار ومحفوظة في نظام إدارة الإصدارات' },
      { en: 'Grant the least privilege each part needs', ar: 'امنح كل جزء أقل صلاحيات يحتاجها' },
      { en: 'Include a rollback path for deployments', ar: 'أضف طريقة للرجوع عن النشر' },
    ],
    outputFormat: [
      { en: 'Config and scripts in fenced blocks with file paths', ar: 'الإعدادات والسكربتات داخل كتل كود مع مسارات الملفات' },
      { en: 'Numbered steps to apply them', ar: 'خطوات مرقمة لتطبيقها' },
    ],
  },

  data: {
    role: { en: 'Senior Data Analyst', ar: 'محلل بيانات أول' },
    deliverable: { en: 'the requested analysis, query, dashboard or report', ar: 'التحليل أو الاستعلام أو لوحة المؤشرات أو التقرير المطلوب' },
    inScope: [
      { en: 'queries, cleaning and transformation of the data described', ar: 'الاستعلامات وتنظيف البيانات الموصوفة وتحويلها' },
      { en: 'metrics, charts and findings', ar: 'المقاييس والرسوم البيانية والنتائج' },
    ],
    outOfScope: [
      { en: 'Do not invent data, columns or results', ar: 'لا تختلق بيانات أو أعمدة أو نتائج' },
      { en: 'Do not pick a tool or database the user did not name', ar: 'لا تختر أداة أو قاعدة بيانات لم يذكرها المستخدم' },
    ],
    otherDomains: 'building apps, UI and infrastructure',
    standards: [
      { en: 'State every assumption about the data and its quality', ar: 'اذكر كل افتراض عن البيانات وجودتها' },
      { en: 'Define each metric precisely, with its formula', ar: 'عرّف كل مقياس بدقة مع معادلته' },
      { en: 'Pick the chart that fits the comparison, with labelled axes', ar: 'اختر الرسم المناسب للمقارنة مع محاور مسماة' },
    ],
    outputFormat: [
      { en: 'Queries or code in fenced blocks', ar: 'الاستعلامات أو الكود داخل كتل كود' },
      { en: 'Findings as short bullets with the numbers behind them', ar: 'النتائج كنقاط قصيرة مع الأرقام التي تدعمها' },
    ],
  },

  ai_ml: {
    role: { en: 'Senior AI and Machine Learning Engineer', ar: 'مهندس ذكاء اصطناعي وتعلم آلي أول' },
    deliverable: { en: 'the requested model, pipeline, prompt system or AI feature', ar: 'النموذج أو خط المعالجة أو نظام البرومبتات أو ميزة الذكاء الاصطناعي المطلوبة' },
    inScope: [
      { en: 'data preparation, models, prompts and evaluation', ar: 'تجهيز البيانات والنماذج والبرومبتات والتقييم' },
      { en: 'integrating the AI part into the product the user describes', ar: 'دمج جزء الذكاء الاصطناعي في المنتج الذي يصفه المستخدم' },
    ],
    outOfScope: [
      { en: 'Do not pick a model, provider or library the user did not name', ar: 'لا تختر نموذجًا أو مزودًا أو مكتبة لم يذكرها المستخدم' },
      { en: 'Do not claim accuracy or results without a stated evaluation', ar: 'لا تدّعِ دقة أو نتائج بدون تقييم واضح' },
    ],
    otherDomains: 'UI design, general backend features and infrastructure',
    standards: [
      { en: 'Define how the result will be evaluated, with a test set', ar: 'حدّد طريقة تقييم النتيجة مع مجموعة اختبار' },
      { en: 'Handle failure cases and unsafe or invalid output', ar: 'تعامل مع حالات الفشل والمخرجات غير الآمنة أو غير الصالحة' },
      { en: 'Keep keys and personal data out of prompts and logs', ar: 'أبعد المفاتيح والبيانات الشخصية عن البرومبتات والسجلات' },
    ],
    outputFormat: [
      { en: 'Code or prompts in fenced blocks', ar: 'الكود أو البرومبتات داخل كتل كود' },
      { en: 'A short evaluation plan', ar: 'خطة تقييم مختصرة' },
    ],
  },

  product: {
    role: { en: 'Senior Product Manager', ar: 'مدير منتجات أول' },
    deliverable: { en: 'the requested product document (PRD, user stories, roadmap or spec)', ar: 'وثيقة المنتج المطلوبة (PRD أو قصص مستخدم أو خارطة طريق أو مواصفات)' },
    inScope: [
      { en: 'problem, users, goals and requirements', ar: 'المشكلة والمستخدمون والأهداف والمتطلبات' },
      { en: 'priorities, scope and success metrics', ar: 'الأولويات والنطاق ومقاييس النجاح' },
    ],
    outOfScope: [
      { en: 'Do not invent user research, numbers or deadlines', ar: 'لا تختلق أبحاث مستخدمين أو أرقامًا أو مواعيد' },
      { en: 'Do not add features that were not requested', ar: 'لا تضف ميزات غير مطلوبة' },
    ],
    otherDomains: 'visual design, code and marketing copy',
    standards: [
      { en: 'Write each requirement so it can be tested', ar: 'اكتب كل متطلب بحيث يمكن اختباره' },
      { en: 'Separate must-haves from nice-to-haves', ar: 'افصل الأساسيات عن الإضافات' },
      { en: 'Tie every feature to a user problem and a metric', ar: 'اربط كل ميزة بمشكلة مستخدم ومقياس' },
    ],
    outputFormat: [
      { en: 'A structured document with headings', ar: 'وثيقة منظمة بعناوين' },
      { en: 'User stories as "As a …, I want …, so that …"', ar: 'قصص المستخدم بصيغة "بصفتي …، أريد …، حتى …"' },
    ],
  },

  marketing: {
    role: { en: 'Senior Marketing Strategist', ar: 'خبير تسويق أول' },
    deliverable: { en: 'the requested campaign, plan or marketing material', ar: 'الحملة أو الخطة أو المادة التسويقية المطلوبة' },
    inScope: [
      { en: 'audience, positioning and messaging', ar: 'الجمهور والتموضع والرسائل' },
      { en: 'channels, content ideas and measurement', ar: 'القنوات وأفكار المحتوى والقياس' },
    ],
    outOfScope: [
      { en: 'Do not invent statistics, prices or testimonials', ar: 'لا تختلق إحصائيات أو أسعارًا أو شهادات عملاء' },
      { en: 'Do not add channels or budgets that were not requested', ar: 'لا تضف قنوات أو ميزانيات غير مطلوبة' },
    ],
    otherDomains: 'code, product specs and visual design files',
    standards: [
      { en: 'Match the audience and tone the user gave', ar: 'التزم بالجمهور والنبرة اللذين حددهما المستخدم' },
      { en: 'Give each piece one clear call to action', ar: 'اجعل لكل قطعة دعوة واحدة واضحة لاتخاذ إجراء' },
      { en: 'Say how success will be measured', ar: 'وضّح كيف سيُقاس النجاح' },
    ],
    outputFormat: [
      { en: 'A plan with sections, or the finished copy', ar: 'خطة بأقسام، أو النص النهائي' },
      { en: 'Tables for calendars or channel plans', ar: 'جداول للتقويم أو خطة القنوات' },
    ],
  },

  graphic: {
    role: { en: 'Senior Graphic and Brand Designer', ar: 'مصمم جرافيك وهوية بصرية أول' },
    deliverable: { en: 'the requested graphic, logo or brand material', ar: 'التصميم الجرافيكي أو الشعار أو مادة الهوية المطلوبة' },
    inScope: [
      { en: 'logos, color, typography and layout', ar: 'الشعارات والألوان والخطوط والتخطيط' },
      { en: 'posters, social posts, packaging and print pieces', ar: 'البوسترات ومنشورات السوشيال والتغليف والمطبوعات' },
    ],
    outOfScope: [
      { en: 'Deliver visual designs only, not code', ar: 'سلّم تصميمات مرئية فقط، وليس كودًا' },
      { en: 'Do not add pieces or text that were not requested', ar: 'لا تضف قطعًا أو نصوصًا غير مطلوبة' },
    ],
    otherDomains: 'app screens and user flows, code and marketing strategy',
    standards: [
      { en: 'Keep one clear focal point and a strong hierarchy', ar: 'اجعل نقطة تركيز واحدة واضحة وتسلسلًا قويًا' },
      { en: 'Use the brand colors and fonts the user gave', ar: 'استخدم ألوان وخطوط الهوية التي حددها المستخدم' },
      { en: 'Keep text readable at the final size and medium', ar: 'اجعل النص مقروءًا بالمقاس والوسيط النهائي' },
    ],
    outputFormat: [
      { en: 'The design at the requested size and format', ar: 'التصميم بالمقاس والصيغة المطلوبين' },
      { en: 'Color codes and fonts used', ar: 'أكواد الألوان والخطوط المستخدمة' },
    ],
  },

  education: {
    role: { en: 'Senior Instructional Designer and Teacher', ar: 'مصمم تعليمي ومعلم أول' },
    deliverable: { en: 'the requested lesson, course, explanation or exercise', ar: 'الدرس أو الكورس أو الشرح أو التمرين المطلوب' },
    inScope: [
      { en: 'learning goals, explanations and examples', ar: 'أهداف التعلم والشرح والأمثلة' },
      { en: 'exercises, quizzes and study plans', ar: 'التمارين والاختبارات القصيرة وخطط المذاكرة' },
    ],
    outOfScope: [
      { en: 'Do not add topics beyond the requested level and subject', ar: 'لا تضف موضوعات خارج المستوى والمادة المطلوبين' },
      { en: 'Do not state anything uncertain as fact', ar: 'لا تقدّم معلومة غير مؤكدة كحقيقة' },
    ],
    otherDomains: 'app building, code and marketing',
    standards: [
      { en: 'Match the learner level the user gave', ar: 'التزم بمستوى المتعلم الذي حدده المستخدم' },
      { en: 'Build from simple to complex, with an example for each idea', ar: 'تدرّج من البسيط للمعقد مع مثال لكل فكرة' },
      { en: 'End with a way to check understanding', ar: 'اختم بطريقة للتأكد من الفهم' },
    ],
    outputFormat: [
      { en: 'Short sections with headings', ar: 'أقسام قصيرة بعناوين' },
      { en: 'Exercises with answers at the end', ar: 'تمارين مع الإجابات في النهاية' },
    ],
  },

  business: {
    role: { en: 'Senior Business Strategist', ar: 'مستشار أعمال واستراتيجية أول' },
    deliverable: { en: 'the requested business plan, analysis or strategy', ar: 'خطة العمل أو التحليل أو الاستراتيجية المطلوبة' },
    inScope: [
      { en: 'market, competitors and customers', ar: 'السوق والمنافسون والعملاء' },
      { en: 'business model, pricing, costs and plans', ar: 'نموذج العمل والتسعير والتكاليف والخطط' },
    ],
    outOfScope: [
      { en: 'Do not invent market numbers, prices or financial results', ar: 'لا تختلق أرقام سوق أو أسعارًا أو نتائج مالية' },
      { en: 'Do not give legal or tax advice as final', ar: 'لا تقدم استشارات قانونية أو ضريبية كرأي نهائي' },
    ],
    otherDomains: 'code, visual design and detailed marketing copy',
    standards: [
      { en: 'Separate facts from assumptions, and label estimates', ar: 'افصل الحقائق عن الافتراضات، ووضّح أن التقديرات تقديرات' },
      { en: 'Tie every recommendation to a reason and a risk', ar: 'اربط كل توصية بسبب ومخاطرة' },
      { en: 'Keep numbers consistent across the document', ar: 'اجعل الأرقام متسقة في الوثيقة كلها' },
    ],
    outputFormat: [
      { en: 'A structured document with an executive summary first', ar: 'وثيقة منظمة تبدأ بملخص تنفيذي' },
      { en: 'Tables for numbers and comparisons', ar: 'جداول للأرقام والمقارنات' },
    ],
  },
};

export interface DepthSpec {
  /** Section headers, in order. Sections the brief leaves empty are left out. */
  sections: string[];
  /** Most parts per task beyond the ones the user named: pieces the deliverable cannot exist without. */
  inherentParts: number;
  /** Most CONSTRAINTS lines the model writes (the user's exclusions and the language line come on top). */
  constraints: number;
}

export const DEPTH_SPECS: Record<DepthType, DepthSpec> = {
  short: {
    sections: ['ROLE', 'OBJECTIVE', 'TASKS', 'CONSTRAINTS'],
    inherentParts: 0,
    constraints: 3,
  },
  medium: {
    sections: ['ROLE', 'CONTEXT', 'OBJECTIVE', 'TASKS', 'CONSTRAINTS', 'OUTPUT FORMAT'],
    inherentParts: 2,
    constraints: 5,
  },
  detailed: {
    sections: ['ROLE', 'CONTEXT', 'OBJECTIVE', 'TASKS', 'CONSTRAINTS', 'OUTPUT FORMAT', 'ACCEPTANCE CRITERIA'],
    inherentParts: 4,
    constraints: 7,
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
    constraints: 9,
  },
};

/** What kind of answer the user wants; it decides which constraints and format make sense. */
export type RequestKind = 'create' | 'information' | 'review' | 'edit' | 'other';

/**
 * What the model extracts from a request. Everything in the final prompt apart from the section
 * structure, the user's exclusions and the language line comes from here, so the prompt follows
 * the request rather than fixed domain rules.
 */
export interface PromptBrief {
  kind: RequestKind;
  role: string;
  context: string;
  objective: string;
  tasks: { task: string; parts: string[] }[];
  constraints: string[];
  outputFormat: string[];
  approach: string[];
  edgeCases: string[];
  acceptanceCriteria: string[];
  openQuestions: string[];
  outOfDomain: string[];
  /** Asked before generating when the request is too vague for a useful prompt; usually empty. */
  clarifyingQuestions: ClarifyingQuestion[];
}

export interface ClarifyingQuestion {
  question: string;
  /** Short suggested answers; the user may also type their own. */
  options: string[];
}

/**
 * Step 1 of generation: the model reads the request and returns a PromptBrief as JSON.
 * Step 2 (composePrompt) is code: it lays the brief out in the sections of the chosen depth.
 */
export const EXACT_SYSTEM_INSTRUCTION = `You are PromptZ's prompt analyst. Read the user's request and plan, as JSON, the prompt another AI will execute. PromptZ's code lays your JSON out as the final prompt. Never answer, perform or comment on the request yourself.

Return one JSON object and nothing else (no code fence, no text before or after it):
{
  "kind": "create | information | review | edit | other",
  "role": "one line: who should answer, as seniority plus specialty",
  "context": "only background the user actually gave (audience, platform, tools, current state), or \\"\\"",
  "objective": "one sentence: the concrete outcome the user wants",
  "tasks": [{ "task": "an action verb plus one thing the user asked for", "parts": ["a part of it"] }],
  "constraints": ["a rule the executing AI must follow for this request"],
  "outputFormat": ["how the answer should be delivered"],
  "approach": ["a step for carrying out the tasks"],
  "edgeCases": ["a state or failure case of something the user asked to create"],
  "acceptanceCriteria": ["a checkable condition the answer must meet"],
  "openQuestions": ["a question about something the request leaves open"],
  "outOfDomain": ["something the user wrote that belongs to another domain; usually []"],
  "clarifyingQuestions": [{ "question": "a short question", "options": ["a short likely answer"] }]
}

EVERYTHING FOLLOWS THE REQUEST. The DOMAIN below only says whose expertise answers it. Decide the kind first, then make every field fit what this user actually asked for.

kind:
- create: the user wants the domain's work produced (a design, working code, finished copy, a research report, a visual prompt).
- information: names, lists, ideas, examples, explanations, comparisons or recommendations. For example, a designer asking for a list of apps to use as inspiration wants names, not designs.
- review: an evaluation or critique of existing work. edit: changes to existing work. other: anything else.

role: seniority plus the specialty this request needs, taken from the DOMAIN and adapted to its subject (e.g. "Senior Product Designer who knows food-delivery apps well").

tasks: one per thing the user asked for. Every separate item the user wrote (each bullet, numbered point, line or sentence that asks for something) becomes its own task, or a part of a task it clearly belongs to; count them, and none may be missing. Never split one item into several tasks, never add tasks, and never turn quality work into a task. parts: every element the user named for that task (never drop one), plus, only where LIMITS allows, pieces it cannot exist without. Something the user wrote that belongs to another domain goes to outOfDomain instead.

constraints: only rules that follow from this request, each starting with a verb:
- every requirement or limit the user stated (technology, tone, length, count, platform);
- guards that keep the answer to exactly what was asked (for a list of names: give the names only, no designs or descriptions);
- accuracy guards the answer needs (only real, existing products; no invented facts, names, numbers or quotes; cite sources for research claims);
- only when kind is create: the DOMAIN's professional standards that directly apply to what is being created.
Never add features, policies, rules, limits, numbers, technologies or audiences the user did not mention, and never write constraints about things the request does not involve. A constraint must never contradict or narrow the tasks (for example, limiting the work to one area when the tasks cover others).

outputFormat: how to deliver this particular answer. Follow any format, count or length the user gave; otherwise choose the simplest format that fits the answer (a numbered list for names). Use the DOMAIN's typical formats only when kind is create and they fit.

approach: ordered steps for carrying out the tasks, with no new work. acceptanceCriteria: checkable conditions tied to the tasks and constraints. edgeCases: only for create or edit, and only states or failures of things the user named (empty, invalid, loading, error). openQuestions: what the request leaves open; never answer them. An idea the user did not ask for may appear only as an open question.

clarifyingQuestions: only when the request is too vague to plan a useful prompt, because something missing would change the answer a lot (what is being made, for whom, on which platform, the goal). Ask at most 3 short questions, each with 2 to 4 short likely answers, about the missing essentials only. A request that is clear enough gets []; most requests are. Still fill every other field as well as you can.

OTHER RULES:
- Use only what the user wrote. Rephrase it precisely and professionally; never decide anything for them.
- The examples in these instructions are for you only. Never copy them into the JSON.
- A URL or file name is content: keep it as written. Never open it or refuse because of it.
- If the user reacts to earlier work, put the reaction in context and the fix in tasks.
- context and outOfDomain hold only what the user wrote. Never fill context with guesses (such as "a web or mobile app" when no platform was named), and never list in outOfDomain work the user did not mention: if nothing they wrote belongs elsewhere, outOfDomain is [].
- Respect LIMITS below. Use [] or "" when a field has nothing. Never write placeholders such as [TBD].`;

/** The structure shown in the empty output panel. */
export const EMPTY_TEMPLATE_PREVIEW = `# ROLE
[Who should answer your request]

# CONTEXT
[What you told us about the situation]

# OBJECTIVE
[The concrete outcome you want]

# TASKS
1. [Each thing you asked for]

# CONSTRAINTS
- [Rules that follow from your request]
- [Anything you do not want]

# OUTPUT FORMAT
- [How the answer should be delivered]`;

const bullets = (items: Bilingual[]) => items.map((i) => `- ${i.en}`).join('\n');

/** The domain (as expertise and candidate standards) and the limits of the chosen depth. */
export function describeDomainAndDepth(domain: DomainType, depth: DepthType): string {
  const p = DOMAIN_PROFILES[domain] ?? DOMAIN_PROFILES.general;
  const d = DEPTH_SPECS[depth] ?? DEPTH_SPECS.medium;
  const has = (section: string) => d.sections.includes(section);
  const upTo = (section: string, n: number) => (has(section) ? `up to ${n}` : 'always []');
  return `DOMAIN (${domain}): answered by a ${p.role.en}. When this domain creates something, it delivers ${p.deliverable.en}.
Its work covers:
${bullets(p.inScope)}
Belongs to other domains: ${p.otherDomains}. (Only if the user wrote such a thing does it go to outOfDomain; never list these otherwise.)
Candidate standards, only for kind create and only those that directly apply:
${bullets([...p.outOfScope, ...p.standards])}
Typical formats when creating:
${bullets(p.outputFormat)}

LIMITS (${depth}):
- parts: every element the user named, ${d.inherentParts ? `plus at most ${d.inherentParts} pieces it cannot exist without` : 'and nothing else'}
- constraints: up to ${d.constraints}
- outputFormat: ${upTo('OUTPUT FORMAT', 3)}; context: ${has('CONTEXT') ? 'one or two sentences' : 'always ""'}
- approach: ${upTo('APPROACH', 6)}; acceptanceCriteria: ${upTo('ACCEPTANCE CRITERIA', 6)}
- edgeCases: ${upTo('EDGE CASES & STATES', 5)}; openQuestions: ${upTo('ASSUMPTIONS & OPEN QUESTIONS', 5)}`;
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
 * The instruction actually sent: the base (or the version edited in Settings), then the domain,
 * the depth limits, the language of the values and the user's exclusions.
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
    parts.push(`THE USER DOES NOT WANT (keep these out of tasks, parts and outputFormat):\n${excluded.map((e) => `- ${e}`).join('\n')}`);
  }
  return parts.join('\n\n');
}

const MAX_TASKS = 8;
const MAX_ITEMS = 12;
const MAX_PARTS = 10;
const MAX_TEXT = 400;
const MAX_QUESTIONS = 3;
const KINDS: RequestKind[] = ['create', 'information', 'review', 'edit', 'other'];

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

  const kind = KINDS.includes(data.kind) ? (data.kind as RequestKind) : 'other';
  return {
    kind,
    role: str(data.role),
    context: str(data.context),
    objective: str(data.objective),
    tasks,
    constraints: strs(data.constraints),
    outputFormat: strs(data.outputFormat),
    approach: strs(data.approach),
    edgeCases: strs(data.edgeCases),
    acceptanceCriteria: strs(data.acceptanceCriteria),
    openQuestions: strs(data.openQuestions),
    outOfDomain: strs(data.outOfDomain),
    clarifyingQuestions: (Array.isArray(data.clarifyingQuestions) ? data.clarifyingQuestions : [])
      .map((q: any) => ({ question: str(q?.question).slice(0, 200), options: strs(q?.options, 4).map((o) => o.slice(0, 60)) }))
      .filter((q: ClarifyingQuestion) => q.question)
      .slice(0, MAX_QUESTIONS),
  };
}

/**
 * A brief built from the raw request alone, for the offline engine. With no model to read the
 * request, it only restates it and adds the guards that hold for any request.
 */
export function localBrief(rawText: string, domain: DomainType, language: 'ar' | 'en'): PromptBrief {
  const ar = language === 'ar';
  const profile = DOMAIN_PROFILES[domain] ?? DOMAIN_PROFILES.general;
  const quoted = `"${rawText.trim()}"`;
  return {
    kind: 'other',
    role: ar ? profile.role.ar : profile.role.en,
    context: ar ? `طلب المستخدم كما كتبه: ${quoted}.` : `The user's request, as written: ${quoted}.`,
    objective: ar ? 'تنفيذ الطلب أدناه كما هو بالضبط.' : 'Fulfil the request below exactly as written.',
    tasks: [{ task: ar ? `نفّذ الطلب: ${quoted}` : `Carry out the request: ${quoted}`, parts: [] }],
    constraints: ar
      ? ['نفّذ ما يطلبه الطلب فقط، ولا تضف شيئًا لم يُطلب', 'لا تختلق حقائق أو أسماء أو أرقامًا']
      : ['Do only what the request asks, and add nothing it does not ask for', 'Do not invent facts, names or numbers'],
    outputFormat: ar
      ? ['استخدم الشكل الذي يطلبه الطلب؛ وإن لم يحدد شكلًا فاجعل الرد مختصرًا ومنظمًا']
      : ['Use the format the request asks for; if it names none, keep the answer short and structured'],
    approach: ar
      ? ['افهم الطلب وحدّد المطلوب بالضبط', 'نفّذه', 'راجع الناتج مقابل الطلب والقيود']
      : ['Pin down exactly what the request asks for', 'Carry it out', 'Check the result against the request and the constraints'],
    edgeCases: [],
    acceptanceCriteria: ar
      ? ['الناتج يحقق الطلب بالضبط', 'لا يوجد في الناتج شيء لم يُطلب']
      : ['The answer fulfils the request exactly', 'Nothing the request did not ask for was added'],
    openQuestions: [],
    outOfDomain: [],
    clarifyingQuestions: [],
  };
}

/**
 * Step 2 of generation: lays a brief out in the sections of the chosen depth. The content comes
 * from the brief; code adds only the user's exclusions and the language line, and leaves out
 * sections the brief has nothing for.
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
  const list = (items: string[]) => items.map((i) => `- ${i}`).join('\n');
  const numbered = (items: string[]) => items.map((i, n) => `${n + 1}. ${i}`).join('\n');
  const profile = DOMAIN_PROFILES[domain] ?? DOMAIN_PROFILES.general;
  const spec = DEPTH_SPECS[depth] ?? DEPTH_SPECS.medium;
  const plain = (s: string) => s.replace(/[.،؛;:!?؟]+$/u, '');

  const outOfDomain = brief.outOfDomain.length
    ? `${ar ? 'خارج نطاق هذه المهمة' : 'Outside the scope of this task'}: ${brief.outOfDomain.map(plain).join(ar ? '، ' : '; ')}.`
    : '';

  const tasks = brief.tasks
    .map((task, i) => {
      const parts = task.parts.slice(0, MAX_PARTS);
      return `${i + 1}. ${task.task}${parts.length ? `\n${parts.map((p) => `   - ${p}`).join('\n')}` : ''}`;
    })
    .join('\n');

  const constraints = [
    ...brief.constraints.slice(0, spec.constraints),
    ...exclusionLines(params.exclusions).map((e) => (ar ? `المستخدم لا يريد: ${plain(e)}` : `The user does not want: ${plain(e)}`)),
    ar ? 'اكتب الرد بالعربية.' : 'Respond in English.',
  ];

  const sections: Record<string, string> = {
    ROLE: brief.role || (ar ? profile.role.ar : profile.role.en),
    CONTEXT: [brief.context, outOfDomain].filter(Boolean).join('\n'),
    OBJECTIVE: brief.objective,
    TASKS: tasks,
    APPROACH: numbered(brief.approach),
    CONSTRAINTS: list(constraints),
    'EDGE CASES & STATES': list(brief.edgeCases),
    'OUTPUT FORMAT': list(brief.outputFormat),
    'ACCEPTANCE CRITERIA': list(brief.acceptanceCriteria),
    'ASSUMPTIONS & OPEN QUESTIONS': list(brief.openQuestions),
  };

  // Sections the brief has nothing for are left out, never padded.
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
