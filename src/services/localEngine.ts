import { DomainType, DepthType, OutputLanguage } from '../types';
import { DOMAINS, DEPTHS } from '../constants';

/**
 * Intelligent local rule-based prompt structuring engine.
 * Works 100% offline with zero external dependencies and zero API keys needed.
 * Analyzes the user's intent, expands requirements, and structures into a professional master prompt.
 */
export function generateLocalStructuredPrompt(params: {
  rawText: string;
  domain: DomainType;
  depth: DepthType;
  outputLanguage: OutputLanguage;
}): string {
  const { rawText, domain, depth, outputLanguage } = params;
  const trimmed = rawText.trim();

  // Detect language if 'match'
  const isArabic =
    outputLanguage === 'ar' ||
    (outputLanguage === 'match' && /[\u0600-\u06FF]/.test(trimmed));

  const domainObj = DOMAINS.find((d) => d.id === domain) || DOMAINS[0];
  const depthObj = DEPTHS.find((d) => d.id === depth) || DEPTHS[1];

  if (isArabic) {
    return generateArabicMasterPrompt(trimmed, domain, depth, domainObj.labelAr);
  } else {
    return generateEnglishMasterPrompt(trimmed, domain, depth, domainObj.labelEn);
  }
}

function generateArabicMasterPrompt(
  input: string,
  domain: DomainType,
  depth: DepthType,
  domainLabel: string
): string {
  const roleByDomain: Record<DomainType, string> = {
    general: 'خبير واستشاري ذكاء اصطناعي وهندسة أوامر (Senior AI Prompt Architect)',
    ui_ux: 'كبير مصممي واجهات وتجربة المستخدم (Principal Product & UI/UX Designer)',
    frontend: 'مهندس واجهات أمامية محترف (Senior Frontend Engineer & React Specialist)',
    backend: 'مهندس معماري لأنظمة الخوادم وقواعد البيانات (Lead Backend & Systems Architect)',
    research: 'باحث ومحلل استراتيجي متقدم (Senior Research Analyst & Data Synthesizer)',
    content: 'خبير استراتيجية المحتوى وصياغة النصوص الإعلانية (Head of Content Strategy & Copywriting)',
    media: 'مخرج فني وخبير توليد الصور والفيديو بالذكاء الاصطناعي (Generative AI Art Director)',
  };

  const domainRole = roleByDomain[domain] || roleByDomain.general;

  const isDetailed = depth === 'detailed' || depth === 'ultra';
  const isUltra = depth === 'ultra';

  return `# ROLE & OBJECTIVE
أنت بصفتك **${domainRole}** متخصص في مجال **${domainLabel}**.
مهمتك الأساسية هي استلام المتطلب التالي:
> "${input}"
وتحويله إلى مخرج تنفيذي متكامل وعالي الجودة، مع مراعاة أعلى المعايير المهنية وحل أي غموض بقرارات هندسية وتصميمية مدروسة لتحقيق أفضل نتيجة ممكنة.

---

# CONTEXT & AUDIENCE
- **سياق العمل**: ${
    domain === 'ui_ux'
      ? 'بناء تجربة مستخدم بديهية، سلسة، ومريحة تقلل من الجهد الإدراكي وتلبي معايير إمكانية الوصول العالمية WCAG.'
      : domain === 'frontend'
      ? 'تنفيذ واجهة مستخدم تفاعلية متجاوبة، نظيفة المعمارية، خالية من الأخطاء البرمجية، وتتبع أفضل ممارسات مكونات الويب.'
      : domain === 'backend'
      ? 'تصميم بنية تحتية برمجية آمنة، سريعة الاستجابة، قابلة للتوسع، وتتعامل بكفاءة مع الاستثناءات ونقاط الضعف.'
      : domain === 'research'
      ? 'تقديم بحث تحليلي منهجي، موثق، يقارن بين البدائل ويوفر رؤى استراتيجية قابلة للتنفيذ المباشر.'
      : domain === 'content'
      ? 'صياغة محتوى جذاب ومؤثر، مصمم خصيصاً للجمهور المستهدف بنبرة متوازنة تحقق أعلى معدلات التفاعل.'
      : domain === 'media'
      ? 'إنتاج موجهات بصرية مفصلة تحدد زوايا الإضاءة، التكوين، نوع العدسات، والألوان بدقة سينمائية.'
      : 'إنجاز المهمة المطلوبة بأعلى دقة تحليلية ومنهجية واضحة ومباشرة.'
  }
- **الجمهور المستهدف**: مستخدمون يبحثون عن حل متقن، احترافي، ومباشر دون حشو أو إطالة غير مفيدة.
- **الافتراضات التشغيلية**: العمل وفق أحدث المعايير والأدوات القياسية المعتمدة في هذا المجال لعام 2026.

---

# DETAILED TASK SPECIFICATION
${
  isUltra
    ? `1. **التحليل الأولي وتفكيك المتطلب**:
   - تفكيك المتطلب: "${input}" إلى عناصره ومكوناته الوظيفية الأساسية.
   - تحديد سيناريوهات الاستخدام الرئيسية والمسار الحرج (Critical Path).
2. **التصميم والتنفيذ المفصل**:
   - إعداد الهيكل الأساسي وفق معايير مجال ${domainLabel}.
   - توضيح خطوات التنفيذ المترابطة بالتفصيل الممل خطوة بخطوة.
   - تغطية حالات الحواف (Edge Cases) وإدارة الأخطاء المتوقعة.
3. **مراجعة الجودة ومطابقة المعايير**:
   - فحص التوافق والأداء وقابلية التوسع والصيانة على المدى الطويل.`
    : isDetailed
    ? `1. **الفهم والتحليل**: تفكيك المتطلب بدقة وتحديد الأهداف الملموسة.
2. **التنفيذ المرحلي**:
   - بناء المخطط أو الهيكل العام للحل.
   - تطبيق التفاصيل الفنية والعملية الخاصة بـ ${domainLabel}.
   - التعامل مع الحالات الاستثنائية وتأمين المخرجات.
3. **التسليم والتطبيق**: تقديم الناتج بصيغة جاهزة للاستخدام الفوري.`
    : `1. استيعاب المتطلب: "${input}".
2. تقديم حل تنفيذي مباشر ومركّز يغطي جوهر المسألة دون تشتيت.
3. إبراز النقاط العملية الجاهزة للتطبيق الفوري في مجال ${domainLabel}.`
}

---

# CONSTRAINTS & RULES
- **ما يجب تجنبه (Negative Constraints)**:
  - تجنب الشروحات النظرية المطولة والمقدمات أو الخواتيم الإنشائية العامة.
  - تجنب الحلول غير المكتملة أو استخدام علامات الحذف المؤقتة (no placeholders / no TODOs).
  - تجنب استخدام تقنيات أو أساليب مهجورة أو غير متوافقة مع المعايير الحديثة.
- **قواعد الجودة**:
  - الالتزام بنبرة عملية، احترافية، ومباشرة.
  - ضمان الوضوح التام والترابط المنطقي بين كل أجزاء الناتج النهائي.
  ${isDetailed ? '- تغطية اعتبارات الأمان، السرعة، وسهولة القراءة والصيانة.' : ''}

---

# OUTPUT FORMAT & SCHEMA
- تنسيق المخرجات بتنسيق **Markdown** أنيق ومقروء مع عناوين واضحة وقوائم نقطية منظمة.
- تضمين أي أكواد أو مواصفات فنية داخل كتل برمجية محددة النوع بدقة.
- تقديم المخرج بلغة عربية فصحى نقية ومهنية خالية من الركاكة.`;
}

function generateEnglishMasterPrompt(
  input: string,
  domain: DomainType,
  depth: DepthType,
  domainLabel: string
): string {
  const roleByDomain: Record<DomainType, string> = {
    general: 'Senior AI Prompt Architect & Systems Strategist',
    ui_ux: 'Principal Product & UI/UX Designer',
    frontend: 'Lead Frontend Web Architect & React Specialist',
    backend: 'Staff Backend & Distributed Systems Engineer',
    research: 'Senior Research Analyst & Synthesis Expert',
    content: 'Head of Content Strategy & Performance Copywriting',
    media: 'Generative AI Creative Director & Visual Stylist',
  };

  const domainRole = roleByDomain[domain] || roleByDomain.general;
  const isDetailed = depth === 'detailed' || depth === 'ultra';

  return `# ROLE & OBJECTIVE
You are acting as a **${domainRole}** specializing in **${domainLabel}**.
Your objective is to ingest the following raw user prompt:
> "${input}"
and transform it into an elite, production-grade output executing the task with surgical precision, adhering to modern 2026 industry standards.

---

# CONTEXT & AUDIENCE
- **Domain Context**: Applying deep best practices in ${domainLabel}, optimizing for usability, maintainability, and real-world execution.
- **Target Audience**: Professionals requiring actionable, definitive outputs with zero fluff or conversational filler.
- **Operational Baseline**: Modern production paradigms, type safety, modular architecture, and high aesthetic/technical craft.

---

# DETAILED TASK SPECIFICATION
1. **Scope Breakdown**: Deconstruct "${input}" into clear deliverables, identifying core requirements and edge scenarios.
2. **Step-by-step Execution**:
   - Provide concrete, end-to-end solutions.
   - Address architectural structure, key considerations, and ergonomic usability.
   ${isDetailed ? '- Account for boundary constraints, validation, and graceful failure handling.' : ''}
3. **Verification**: Ensure all proposed logic or designs adhere to best practices in ${domainLabel}.

---

# CONSTRAINTS & RULES
- **Negative Constraints**:
  - No introductory pleasantries ("Sure, I can help with that", "Here is your solution").
  - No hand-wavy placeholders, ellipsis shortcuts, or incomplete snippets.
  - Do not use deprecated APIs, libraries, or obsolete design patterns.
- **Positive Heuristics**:
  - Maintain an authoritative, concise, and structured tone.
  - Prioritize actionable clarity and robust execution.

---

# OUTPUT FORMAT & SCHEMA
- Return the response in clean, well-formatted Markdown with prominent headings and bulleted hierarchies.
- Code or schemas must be enclosed in appropriately tagged syntax blocks.`;
}
