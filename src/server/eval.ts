/**
 * /api/eval: runs a fixed set of requests through the real generation path and checks each prompt
 * automatically (the model's brief was usable, the language is right, nothing the user did not ask
 * for appears). Open it in a browser after a deploy to see whether prompt quality held up.
 * Costs one OpenRouter call per case, about the same as generating that many prompts on the site.
 */
import { detectRequestLanguage } from '../prompting.js';
import { DepthType, DomainType, OutputLanguage } from '../types.js';
import { handleGenerate } from './api.js';

interface EvalCase {
  name: string;
  rawText: string;
  domain: DomainType;
  depth: DepthType;
  outputLanguage?: OutputLanguage;
  exclusions?: string;
  /** The language the prompt must be written in. */
  language: 'ar' | 'en';
  /** Must not appear anywhere in the prompt. */
  forbidden?: RegExp;
  /** Must not appear in TASKS (for words the user used in exclusions, which do appear in CONSTRAINTS). */
  forbiddenInTasks?: RegExp;
  /** Must appear somewhere in the prompt. */
  expected?: RegExp;
  /** Everything the user named: each must appear in TASKS, so nothing requested is dropped. */
  requiredInTasks?: RegExp[];
  maxTasks?: number;
}

const CASES: EvalCase[] = [
  {
    name: 'Backend login, sign-up link is out of domain',
    rawText: 'عايز صفحة تسجيل دخول فيها ايميل وباسورد ولينك للتسجيل',
    domain: 'backend',
    depth: 'ultra',
    language: 'ar',
    forbidden: /JWT|OAuth|remember me|تذكرني|rate.?limit|تعقيد|complexity|MFA|قفل الحساب|lockout/i,
    forbiddenInTasks: /register|sign.?up|إنشاء حساب|حساب جديد|تسجيل مستخدم/i,
    expected: /خارج نطاق/,
    requiredInTasks: [/email|بريد|إيميل|ايميل/i, /password|كلمة المرور|باسورد/i],
    maxTasks: 2,
  },
  {
    name: 'UI login screen, no extra controls',
    rawText: 'Login screen with email, password and a sign up link',
    domain: 'ui_ux',
    depth: 'medium',
    language: 'en',
    // Also nothing about servers, APIs or platforms, which the user never mentioned.
    forbidden: /remember me|dark mode|social login|Google|Facebook|MFA|two.?factor|biometric|server|\bAPI|authentication logic|web or mobile/i,
    requiredInTasks: [/email/i, /password/i, /sign.?up|register|create an? account/i],
    // Creating a design: design standards belong in the prompt.
    expected: /hover|focus|error state|contrast|spacing|hierarchy/i,
    maxTasks: 2,
  },
  {
    name: 'UI inspiration list: names only, no design rules',
    rawText: 'عايز ليستة بأسماء تطبيقات أكل أخد منها إنسبيريشن للتصميم',
    domain: 'ui_ux',
    depth: 'medium',
    language: 'ar',
    // Asking for names is not asking for a design: no design standards, frames or states.
    forbidden: /8.?(point|نقاط)|مضاعفات 8|WCAG|التباين|إطار لكل|frames?\b|hover|التمرير|Figma|touch target|مساحات اللمس|lorem/i,
    requiredInTasks: [/تطبيق|app/i],
    maxTasks: 2,
  },
  {
    name: 'Backend question: an explanation, not code',
    rawText: 'Explain the difference between REST and GraphQL',
    domain: 'backend',
    depth: 'detailed',
    language: 'en',
    forbidden: /fenced|code blocks?|HTTP status|idempoten|environment variable|endpoint list|file paths?/i,
    requiredInTasks: [/REST/, /GraphQL/],
    maxTasks: 2,
  },
  {
    name: 'Frontend landing page, no assumed framework',
    rawText: 'صفحة هبوط لتطبيق توصيل أكل فيها هيرو وزرار تحميل التطبيق',
    domain: 'frontend',
    depth: 'detailed',
    language: 'ar',
    forbidden: /React|Next\.?js|Vue|Angular|Tailwind|Bootstrap|testimonial|آراء العملاء|الأسعار|pricing|FAQ|الأسئلة الشائعة/i,
    requiredInTasks: [/هيرو|hero|الرئيسي|الافتتاحي/i, /تحميل|تنزيل|download/i],
    maxTasks: 3,
  },
  {
    name: 'Content caption, one channel only',
    rawText: 'Instagram caption for a coffee shop opening, friendly tone',
    domain: 'content',
    depth: 'short',
    language: 'en',
    forbidden: /TikTok|Facebook|email|newsletter|blog|Twitter|LinkedIn/i,
    requiredInTasks: [/caption/i],
    maxTasks: 1,
  },
  {
    name: 'Research comparison, only the named tools',
    rawText: 'Compare Notion and Obsidian for personal note taking',
    domain: 'research',
    depth: 'medium',
    language: 'en',
    forbidden: /Evernote|OneNote|Roam|Logseq|Bear/i,
    requiredInTasks: [/Notion/, /Obsidian/],
    maxTasks: 2,
  },
  {
    name: 'Media prompt, no extra subjects',
    rawText: 'Cinematic photo of a cat on a rooftop at sunset, 16:9',
    domain: 'media',
    depth: 'ultra',
    language: 'en',
    forbidden: /\bdog\b|logo|watermark|\bperson\b|people/i,
    requiredInTasks: [/cat/i],
    maxTasks: 2,
  },
  {
    name: 'Backend list endpoint, no other operations',
    rawText: "REST endpoint that lists a user's orders",
    domain: 'backend',
    depth: 'short',
    language: 'en',
    forbiddenInTasks: /create|delete|update|cancel|payment|refund/i,
    forbidden: /JWT|GraphQL|PostgreSQL|MySQL|MongoDB/i,
    requiredInTasks: [/order/i],
    maxTasks: 1,
  },
  {
    name: 'General study plan, one subject',
    rawText: 'خطة مذاكرة لمادة الفيزياء لمدة أسبوعين',
    domain: 'general',
    depth: 'medium',
    language: 'ar',
    forbidden: /كيمياء|رياضيات|أحياء|chemistry|math|biology/i,
    requiredInTasks: [/فيزياء|الفيزيا/],
    maxTasks: 2,
  },
  {
    name: 'English request, Arabic output chosen',
    rawText: 'Write a product description for wireless earbuds',
    domain: 'content',
    depth: 'medium',
    outputLanguage: 'ar',
    language: 'ar',
    forbidden: /noise.?cancell|إلغاء الضوضاء|battery|البطارية|waterproof|مقاوم/i,
    requiredInTasks: [/سماع|earbuds/i],
    maxTasks: 1,
  },
  {
    name: 'Every item of a list becomes a task',
    rawText:
      'تحسين شريط التنقل (Navbar) وضبط المسافات بين أيقونات اللغة، والمظهر، والحساب، مع توحيد ارتفاع أيقونة الحساب ليتساوى مع ارتفاع الأيقونات المجاورة.\n- إضافة معظم النطاقات (Domains) المتاحة.\n- تعزيز إبراز العمق (Depth) من خلال إضافة حدود (Stroke) خفيفة، مع زيادة التفاعل وإبراز أيقونات الإعجاب وعدم الإعجاب (Like/Dislike) بشكل أوضح وتفاعلاتها',
    domain: 'frontend',
    depth: 'medium',
    language: 'ar',
    // No item may be dropped, and no constraint may shrink the work to the navbar alone.
    requiredInTasks: [/navbar|شريط التنقل/i, /domain|النطاقات|المجالات/i, /depth|العمق/i, /like|dislike|الإعجاب/i],
    forbidden: /navbar only|only (to )?the navbar|شريط التنقل فقط|على شريط التنقل وحده|Navbar فقط/i,
    maxTasks: 5,
  },
  {
    name: 'Exclusions stay out of the tasks',
    rawText: 'Sign up form with name, email and password',
    domain: 'ui_ux',
    depth: 'short',
    exclusions: 'no social login',
    language: 'en',
    forbiddenInTasks: /social|Google|Facebook|Apple/i,
    expected: /does not want: no social login/i,
    requiredInTasks: [/name/i, /email/i, /password/i],
    maxTasks: 1,
  },
];

export interface EvalResult {
  name: string;
  domain: DomainType;
  depth: DepthType;
  passed: boolean;
  problems: string[];
  modelUsed?: string;
  /** What the automatic check found in the model's first brief, and whether its fix was used. */
  autoFix?: { issues: string[]; repaired: boolean };
  prompt: string;
}

/** The text of one "# SECTION" of a prompt. */
function section(prompt: string, name: string): string {
  // Up to the next "# HEADER" line or the end of the prompt ($ would stop at the first line end with the m flag).
  const match = prompt.match(new RegExp(`^# ${name}\\n([\\s\\S]*?)(?=\\n# |(?![\\s\\S]))`, 'm'));
  return match ? match[1] : '';
}

function check(c: EvalCase, body: any): EvalResult {
  const prompt: string = body?.result || '';
  const tasks = section(prompt, 'TASKS');
  const problems: string[] = [];

  if (body?.error) problems.push(`Model unavailable: ${body.error.detail || body.error.message}`);
  if (body?.fallbackUsed) problems.push(`Model not used (local engine): ${body.fallbackReason || 'no reason given'}`);
  const language = detectRequestLanguage(tasks.replace(/"[^"]*"/g, ''));
  if (language !== c.language) problems.push(`Wrong language: expected ${c.language}, got ${language}`);

  const found = c.forbidden && prompt.match(c.forbidden);
  if (found) problems.push(`Added something not requested: "${found[0]}"`);
  const foundInTasks = c.forbiddenInTasks && tasks.match(c.forbiddenInTasks);
  if (foundInTasks) problems.push(`Task not requested: "${foundInTasks[0]}"`);
  if (c.expected && !c.expected.test(prompt)) problems.push(`Missing: ${c.expected.source}`);
  for (const required of c.requiredInTasks || []) {
    if (!required.test(tasks)) problems.push(`Requested but missing from TASKS: ${required.source}`);
  }

  const taskCount = (tasks.match(/^\d+\./gm) || []).length;
  if (c.maxTasks && taskCount > c.maxTasks) problems.push(`Too many tasks: ${taskCount} (max ${c.maxTasks})`);

  return { name: c.name, domain: c.domain, depth: c.depth, passed: problems.length === 0, problems, modelUsed: body?.modelUsed, autoFix: body?.check, prompt };
}

/** Runs every case, three at a time so OpenRouter does not rate-limit the run. */
export async function runEval(serverKey?: string): Promise<{ passed: number; total: number; seconds: number; results: EvalResult[] }> {
  const started = Date.now();
  const results: EvalResult[] = new Array(CASES.length);
  let next = 0;
  const worker = async () => {
    while (next < CASES.length) {
      const i = next++;
      const c = CASES[i];
      const { body } = await handleGenerate(
        {
          rawText: c.rawText,
          domain: c.domain,
          depth: c.depth,
          outputLanguage: c.outputLanguage || 'match',
          exclusions: c.exclusions,
          skipClarify: true,
        },
        undefined,
        serverKey
      );
      results[i] = check(c, body);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return {
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    seconds: Math.round((Date.now() - started) / 1000),
    results,
  };
}

const escape = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

/** The eval as a readable page. */
export function renderEvalPage(run: Awaited<ReturnType<typeof runEval>>): string {
  const rows = run.results
    .map(
      (r) => `<details${r.passed ? '' : ' open'}>
<summary><b class="${r.passed ? 'ok' : 'bad'}">${r.passed ? 'PASS' : 'FAIL'}</b> ${escape(r.name)} <span>${r.domain} · ${r.depth}</span></summary>
${r.autoFix?.issues.length ? `<p>Auto-check: ${escape(r.autoFix.issues.join(', '))} · ${r.autoFix.repaired ? 'fixed by the model' : 'not fixed'}</p>` : ''}
${r.problems.length ? `<ul>${r.problems.map((p) => `<li>${escape(p)}</li>`).join('')}</ul>` : ''}
<pre dir="auto">${escape(r.prompt)}</pre>
</details>`
    )
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PromptZ eval</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#111;--muted:#666;--line:#ddd;--ok:#0a7d38;--bad:#c62828}
@media (prefers-color-scheme:dark){:root{--bg:#111;--fg:#eee;--muted:#999;--line:#333;--ok:#4ade80;--bad:#f87171}}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;max-width:900px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:0 0 4px}p{color:var(--muted);margin:0 0 16px}
details{border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:0 0 10px}
summary{cursor:pointer}summary span{color:var(--muted);font-size:13px}
.ok{color:var(--ok)}.bad{color:var(--bad)}ul{color:var(--bad);margin:8px 0}
pre{white-space:pre-wrap;word-break:break-word;font-size:13px;border-top:1px solid var(--line);padding-top:8px}
</style></head><body>
<h1>${run.passed} / ${run.total} passed</h1>
<p>Each case is a fixed request run through the live model, then checked automatically. ${run.seconds}s. Auto-fixed: ${run.results.filter((r) => r.autoFix?.repaired).length}.</p>
${rows}
</body></html>`;
}
