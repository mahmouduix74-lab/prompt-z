/**
 * Local Linguistic Refiner Engine
 * Bulletproof offline & fallback prompt enhancer that guarantees
 * high-quality, professional requirement refinement without API failures.
 */

export interface RefineOptions {
  rawText: string;
  domain?: string;
}

export function refineLocalPromptText(options: RefineOptions | string): string {
  const raw = typeof options === 'string' ? options.trim() : options.rawText.trim();
  const domain = typeof options === 'string' ? 'general' : options.domain || 'general';

  if (!raw) return '';

  const isArabic = /[\u0600-\u06FF]/.test(raw);

  // Clean conversational prefixes
  let cleaned = raw;
  if (isArabic) {
    cleaned = cleaned
      .replace(/^(عايز|محتاج|ياريت|ممكن|بدي|ابغى|اريد|من فضلك|لو سمحت|سويلي|اعملي)\s+/i, '')
      .replace(/^(تصميم|بناء|برمجة|انشاء|كتابة)\s+/i, (match) => match.trim() + ' ');
  } else {
    cleaned = cleaned
      .replace(/^(i want|i need|please|can you|could you|build me|create a|make a|write a)\s+/i, '')
      .trim();
  }

  if (isArabic) {
    return generateArabicRefinement(cleaned, domain);
  } else {
    return generateEnglishRefinement(cleaned, domain);
  }
}

function generateArabicRefinement(cleaned: string, domain: string): string {
  const domainLower = domain.toLowerCase();

  if (domainLower.includes('code') || /كود|برمج|تطبيق|موقع|api|بوت|خوارزمية|سكربت/i.test(cleaned)) {
    return `تطوير نظام برمجي متكامل لـ: ${cleaned}

المتطلبات التقنية والهندسية:
1. البنية التحتية: كتابة كود نظيف وقابل للتوسع وموثق وفق مبادئ Clean Code و SOLID، مع مراعاة أعلى معايير الأمان (Security & Validation).
2. تدفق البيانات والمنطق البرمجي: معالجة كافة الحالات الحدية (Edge Cases) وإدارة الأخطاء والاستثناءات بصورة استباقية.
3. التوافق والأداء: تقديم حل عالي الكفاءة مع تقليل استهلاك الموارد وسرعة الاستجابة.
4. المخرجات المطلوبة: توفير الكود المصدري كاملاً مع تعليقات توضيحية لخطوات التثبيت والتنفيذ وطريقة الاختبار.`;
  }

  if (domainLower.includes('market') || domainLower.includes('business') || /تسويق|خطة|مبيعات|شركة|مشروع|اعلان|حملة/i.test(cleaned)) {
    return `إعداد استراتيجية عمل وتسويق شاملة لـ: ${cleaned}

الأهداف والمحاور التنفيذية:
1. تحديد الجمهور المستهدف: رسم ملامح العميل المثالي (Buyer Persona) ونقاط الألم والاحتياجات الرئيسية.
2. الميزة التنافسية والقيمة المقترحة (USP): صياغة رسائل تسويقية مقنعة ذات نبرة صوت احترافية وجذابة.
3. خطة العمل والقنوات: تحديد أفضل القنوات التسويقية ومراحل التحويل ومؤشرات قياس الأداء (KPIs).
4. خطة التنفيذ والجدول الزمني: خطوات إجرائية واضحة ومقاييس عائد الاستثمار (ROI).`;
  }

  if (domainLower.includes('creative') || /قصة|سيناريو|مقال|شعر|رواية|حوار/i.test(cleaned)) {
    return `صياغة عمل إبداعي أدبي متقن يدور حول: ${cleaned}

المعايير الفنية والأسلوبية:
1. الأسلوب واللغة: استخدام بلاغة لغوية راقية وصور بيانية آسرة مع تماسك الإيقاع والنبرة.
2. البناء الدرامي والشخصيات: تطوير حبكة متصاعدة ذات أبعاد نفسية وشعورية عميقة تجذب القارئ.
3. الرسالة والجو العام: خلق أجواء غامرة وتفاصيل حسية تنقل الفكرة ببراعة وتأثير دائم.`;
  }

  if (domainLower.includes('academic') || /بحث|دراسة|تحليل|علمي|اطروحة/i.test(cleaned)) {
    return `إعداد دراسة بحثية وتحليلية معمقة حول: ${cleaned}

المنهجية العلمية المطلوبة:
1. الإطار المفاهيمي: تأصيل المصطلحات الأساسية واستعراض الخلفية النظرية للموضوع.
2. التحليل المنهجي: تفكيك الظاهرة وفحص الأدلة والبراهين بأسلوب نقدي وموضوعي محايد.
3. الاستنتاجات والتوصيات: صياغة نتائج دقيقة قابلة للتطبيق مع توثيق المصادر والمنهجيات المعتمدة.`;
  }

  // General high-quality default
  return `تقديم خطة تنفيذ وتوجيه دقيق ومفصل بشأن: ${cleaned}

عناصر الطلب الأساسية:
1. الغاية والهدف الأساسي: تحديد المخرجات المرجوة بدقة مع شرح السياق العملي للتطبيق.
2. خطوات الإنجاز: ترتيب المهام تسلسلياً بوضوح لضمان أقصى درجات الفعالية وتجنب الغموض.
3. معايير الجودة والضوابط: الالتزام بأفضل الممارسات المتبعة وتقديم أمثلة إيضاحية جاهزة للاستخدام الفوري.`;
}

function generateEnglishRefinement(cleaned: string, domain: string): string {
  const domainLower = domain.toLowerCase();

  if (domainLower.includes('code') || /code|app|software|api|bot|script|algorithm|backend|frontend/i.test(cleaned)) {
    return `Develop a comprehensive, production-ready engineering solution for: ${cleaned}

Key Engineering Specifications:
1. Architecture & Clean Code: Build using modular, scalable design patterns (SOLID principles) with comprehensive type safety and inline documentation.
2. Reliability & Edge Cases: Implement robust error handling, defensive input validation, and asynchronous fault tolerance.
3. Performance & Security: Optimize for sub-second latency, resource efficiency, and OWASP security standards.
4. Deliverables: Full, un-truncated implementation code accompanied by configuration requirements and test verification commands.`;
  }

  if (domainLower.includes('market') || domainLower.includes('business') || /marketing|sales|business|campaign|strategy|startup/i.test(cleaned)) {
    return `Create an executive-level strategic roadmap and execution plan for: ${cleaned}

Strategic Focus Areas:
1. Target Audience & Positioning: Clearly articulate the Ideal Customer Profile (ICP), core pain points, and distinct Unique Value Proposition (UVP).
2. Actionable Playbook: Formulate multi-channel acquisition tactics, messaging frameworks, and conversion funnels.
3. Metrics & KPIs: Establish measurable milestones, projected ROI metrics, and practical resource allocations.`;
  }

  // General default for English
  return `Provide a comprehensive, highly articulated specification and solution for: ${cleaned}

Core Execution Objectives:
1. Objective & Scope: Clarify end goals with precise, unambiguous context and functional requirements.
2. Phased Methodology: Break down execution into logical, sequential steps adhering to modern industry standards.
3. Quality Criteria & Output: Ensure clean structure, practical applicability, and self-contained clarity without filler language.`;
}
