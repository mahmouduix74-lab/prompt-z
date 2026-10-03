/**
 * Checks a model's brief against the request before the prompt is shown, for the mistakes the
 * model makes most: dropping an item of the request, a constraint that shrinks the work to part
 * of the tasks, and content the user never wrote. Each problem is a sentence the model can act
 * on; the API asks the model to fix them once (see handleGenerate).
 */
import { PromptBrief, detectRequestLanguage } from './prompting.js';

export interface BriefIssue {
  kind: 'missing_item' | 'narrowing_constraint' | 'invented_out_of_domain' | 'excluded_in_tasks' | 'missing_answer' | 'unrequested_prompt' | 'description_instead';
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

/**
 * The answers the user gave to clarifying questions: the site adds them under "More details:" /
 * "تفاصيل إضافية:" as "- <question> <answer>". Only the answer part, after the question mark.
 */
export function clarifyAnswers(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s*(more details|تفاصيل إضافية)\s*:\s*$/i.test(l));
  if (start < 0) return [];
  return lines
    .slice(start + 1)
    .filter((l) => /^\s*-\s+/.test(l))
    .map((l) => {
      const line = l.replace(/^\s*-\s+/, '');
      const mark = Math.max(line.lastIndexOf('?'), line.lastIndexOf('؟'));
      return (mark >= 0 ? line.slice(mark + 1) : line).trim();
    })
    .filter(Boolean);
}

const PROMPT_WORD = /\bprompts?\b|برومبت/i;
const DESCRIPTION_WORD = /\bdescri(?:be|bes|bing|ptions?)\b|\bconcepts?\b|وصف|تصور/i;

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

  // 5. Every answer to a clarifying question is used somewhere. The coverage list maps lines to
  // tasks but cannot tell that the answer itself ("take it from the Figma file") was dropped.
  // A suggestion is optional, so an answer used only there still counts as dropped.
  const briefText = JSON.stringify({ ...brief, coverage: [], clarifyingQuestions: [], suggestions: [] });
  for (const answer of clarifyAnswers(requestText)) {
    if (detectRequestLanguage(answer) !== language) continue;
    const numbers = answer.match(/\d+(?:[:.,/x×]\d+)*/g) || [];
    const used = overlap(answer, briefText) > 0 || numbers.some((n) => briefText.includes(n));
    if (!used && (words(answer).length || numbers.length)) {
      issues.push({ kind: 'missing_answer', message: `The user answered a clarifying question with "${answer}", but nothing in the JSON uses that answer. Put it where it belongs (context, a task part or a constraint).` });
    }
  }

  // 6. A prompt only when the user asked for one: "make an artwork" must not become "write a
  // prompt for an artwork" (or a negative prompt and generation parameters).
  if (!PROMPT_WORD.test(requestText)) {
    const { coverage, clarifyingQuestions, ...planned } = brief;
    const found = JSON.stringify(planned).match(PROMPT_WORD);
    if (found) {
      issues.push({ kind: 'unrequested_prompt', message: `The user did not ask for a prompt, but the JSON asks for one ("${found[0]}"). Ask for the thing the user asked for itself (the artwork, the video, the design), and remove every mention of a prompt, a negative prompt or generation parameters.` });
    }
  }

  // 7. Asked to make something, the answer is that thing, not a description or concept of it
  // ("a rendered image description" instead of the image).
  if (brief.kind === 'create' && !DESCRIPTION_WORD.test(requestText)) {
    const found = brief.outputFormat.join(' ').match(DESCRIPTION_WORD);
    if (found) {
      issues.push({ kind: 'description_instead', message: `The user asked for the thing itself, but outputFormat asks for a ${found[0]} of it. Make outputFormat deliver the thing itself (the image, the video, the design, the code).` });
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
