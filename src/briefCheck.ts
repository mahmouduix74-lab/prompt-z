/**
 * Checks a model's brief against the request before the prompt is shown, for the mistakes the
 * model makes most: dropping an item of the request, a constraint that shrinks the work to part
 * of the tasks, and content the user never wrote. Each problem is a sentence the model can act
 * on; the API asks the model to fix them once (see handleGenerate).
 */
import { PromptBrief, detectRequestLanguage } from './prompting.js';

export interface BriefIssue {
  kind: 'missing_item' | 'narrowing_constraint' | 'invented_out_of_domain' | 'excluded_in_tasks';
  message: string;
}

const STOPWORDS = new Set(
  (
    'the and for with that this from into your you are was were will should must can all any each ' +
    'use make add adjust improve create build also more most than then them they their its not only just solely exclusively ' +
    'على الى إلى في من مع عن او أو ثم كل بعض هذا هذه ذلك التي الذي اللي عايز عاوز محتاج ممكن لازم يكون تكون ' +
    'فقط وحده وحدها بشكل خلال مثل كده كدا دا دي ده بتاع بتاعة اضافة إضافة تحسين تعزيز زيادة ضبط عمل'
  ).split(' ')
);

/** Lowercased words with Arabic spelling variants folded together and the article removed. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => w.replace(/^(وال|بال|لل|ال)(?=\p{L}{3})/u, ''))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/** Share of a's words that also appear in b. */
function overlap(a: string, b: string): number {
  const wa = words(a);
  if (!wa.length) return 0;
  const wb = new Set(words(b));
  return wa.filter((w) => wb.has(w)).length / wa.length;
}

/**
 * The separate items of a request: its lines, without bullet or number markers. A lead-in line
 * ending in ":" and very short lines are not items.
 */
export function requestItems(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•▪◦]|[0-9٠-٩]+[.)\-–]|[a-zA-Z][.)])\s*/, '').trim())
    .filter((line) => line && !/[:：]$/.test(line) && words(line).length >= 2);
}

const ONLY = /\b(only|solely|exclusively|just)\b|فقط|وحده|وحدها|حصر[اًيا]*|دون غيره/i;
const taskText = (t: PromptBrief['tasks'][number]) => [t.task, ...t.parts].join(' ');

export function checkBrief(brief: PromptBrief, requestText: string, exclusions = '', language: 'ar' | 'en' = 'en'): BriefIssue[] {
  const issues: BriefIssue[] = [];
  const tasks = brief.tasks.map(taskText);

  // 1. Every item of the request is covered by a task.
  const items = requestItems(requestText);
  if (items.length >= 2) {
    if (brief.coverage.length) {
      for (const item of items) {
        const entry = brief.coverage.find((c) => overlap(item, c.item) >= 0.6 || overlap(c.item, item) >= 0.8);
        if (!entry) {
          issues.push({ kind: 'missing_item', message: `This item of the request is missing from coverage and may be missing from the tasks: "${item}". Cover it with a task or a part of one, and list it in coverage.` });
        } else if (entry.task > brief.tasks.length || entry.task < 0) {
          issues.push({ kind: 'missing_item', message: `coverage points "${item}" to task ${entry.task}, which does not exist. Cover it with a task or a part of one.` });
        }
      }
    } else if (brief.tasks.reduce((n, t) => n + 1 + t.parts.length, 0) < items.length) {
      issues.push({ kind: 'missing_item', message: `The request has ${items.length} separate items but the tasks and parts cover fewer. Every item must become a task or a part of one: ${items.map((i) => `"${i}"`).join(', ')}.` });
    }
  }

  // 2. A constraint that confines the work ("only the navbar") to some of the tasks.
  if (brief.tasks.length >= 2) {
    for (const constraint of brief.constraints) {
      if (!ONLY.test(constraint)) continue;
      const touched = tasks.filter((t) => words(constraint).some((w) => words(t).includes(w))).length;
      if (touched > 0 && touched < tasks.length) {
        issues.push({ kind: 'narrowing_constraint', message: `This constraint limits the work to part of the tasks: "${constraint}". Remove it, or rewrite it so it applies to every task.` });
      }
    }
  }

  // 3. outOfDomain may only hold what the user wrote. Word overlap only works in one language.
  if (detectRequestLanguage(requestText) === language) {
    for (const item of brief.outOfDomain) {
      if (overlap(item, requestText) === 0) {
        issues.push({ kind: 'invented_out_of_domain', message: `outOfDomain lists something the user did not write: "${item}". outOfDomain holds only things the user wrote; remove it.` });
      }
    }
  }

  // 4. What the user said they do not want never becomes work.
  const excluded = exclusions
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\s]+/, '').replace(/^(no|without|not|don't|بدون|من غير|مش|لا)\s+/i, '').trim())
    .filter((line) => words(line).length);
  for (const line of excluded) {
    for (const t of brief.tasks) {
      if (overlap(line, taskText(t)) >= 0.99) {
        issues.push({ kind: 'excluded_in_tasks', message: `The user does not want "${line}", but the task "${t.task}" includes it. Take it out of the tasks and parts.` });
      }
    }
  }

  return issues;
}

/** The follow-up message that asks the model to fix its own brief. */
export function repairRequest(issues: BriefIssue[]): string {
  return `PromptZ checked your JSON against the request and found these problems:
${issues.map((i) => `- ${i.message}`).join('\n')}

Return the whole corrected JSON object and nothing else. Fix only these problems and keep everything else as it was; follow all the earlier rules.`;
}
