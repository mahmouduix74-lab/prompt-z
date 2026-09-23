import { DomainType, DepthType, OutputLanguage } from '../types.js';
import { Bilingual, DEPTH_SPECS, DOMAIN_PROFILES, resolveOutputLanguage } from '../prompting.js';

/**
 * Offline prompt builder, used when no API key is set or the model is unavailable.
 * It follows the same domain profiles and depth sections as the model does
 * (prompting.ts), so the fallback still changes with the selected domain and depth.
 */
export function generateLocalStructuredPrompt(params: {
  rawText: string;
  domain: DomainType;
  depth: DepthType;
  outputLanguage: OutputLanguage;
}): string {
  const request = params.rawText.trim();
  const ar = resolveOutputLanguage(params.outputLanguage, request) === 'ar';
  const t = (text: Bilingual) => (ar ? text.ar : text.en);
  const list = (items: Bilingual[]) => items.map((i) => `- ${t(i)}`).join('\n');

  const profile = DOMAIN_PROFILES[params.domain] ?? DOMAIN_PROFILES.general;
  const spec = DEPTH_SPECS[params.depth] ?? DEPTH_SPECS.medium;
  const quoted = `"${request}"`;

  const standards = profile.standards.slice(0, spec.standards);
  // Domain boundaries first (they keep the executor in scope), then standards; the language line always stays.
  const constraints: Bilingual[] = [
    ...[...profile.outOfScope, ...standards].slice(0, spec.constraints[1] - 1),
    { en: 'Respond in English.', ar: 'اكتب الرد بالعربية.' },
  ];

  const subPoints = profile.inScope.slice(0, spec.subPoints);
  const task =
    `1. ${ar ? 'سلّم' : 'Deliver'} ${t(profile.deliverable)}${ar ? ' للطلب:' : ' for:'} ${quoted}` +
    (subPoints.length ? `\n${subPoints.map((s) => `   - ${t(s)}`).join('\n')}` : '');

  const sections: Record<string, string> = {
    ROLE: t(profile.role),
    CONTEXT: ar
      ? `طلب المستخدم كما كتبه: ${quoted}. لم تُذكر تفاصيل إضافية عن الجمهور أو المنصة.`
      : `The user's request, as written: ${quoted}. No further details about audience or platform were given.`,
    OBJECTIVE: ar
      ? `تسليم ${t(profile.deliverable)} بما يحقق الطلب بالضبط، دون أي إضافات.`
      : `Deliver ${t(profile.deliverable)} that fulfils the request exactly, with nothing added.`,
    TASKS: task,
    APPROACH: ar
      ? '1. افهم الطلب وحدّد المطلوب بالضبط.\n2. خطّط العمل داخل حدود المجال.\n3. نفّذ المهام بالترتيب.\n4. راجع الناتج مقابل معايير القبول.'
      : '1. Read the request and pin down exactly what is asked.\n2. Plan the work inside the domain boundaries.\n3. Carry out the tasks in order.\n4. Check the result against the acceptance criteria.',
    CONSTRAINTS: list(constraints),
    'EDGE CASES & STATES': ar
      ? '- المدخلات الناقصة أو غير الصحيحة\n- الحالات الفارغة وحالات الخطأ حيث ينطبق ذلك\n- المحتوى الطويل جدًا أو غير المعتاد'
      : '- Missing or invalid input\n- Empty and error states where they apply\n- Very long or unusual content',
    'OUTPUT FORMAT': list(profile.outputFormat),
    'ACCEPTANCE CRITERIA': list([
      { en: 'Every task above is delivered, and nothing outside the request', ar: 'كل مهمة أعلاه منفذة، ولا شيء خارج الطلب' },
      { en: 'Every constraint is respected', ar: 'كل القيود محترمة' },
      ...standards,
    ]),
    'ASSUMPTIONS & OPEN QUESTIONS': ar
      ? '- ما المنصة أو الأداة المستهدفة؟\n- من الجمهور المستهدف؟\n- هل توجد أمثلة أو مراجع يجب الالتزام بها؟'
      : '- Which platform or tool is this for?\n- Who is the audience?\n- Are there examples or references to follow?',
  };

  return spec.sections.map((name) => `# ${name}\n${sections[name]}`).join('\n\n');
}
