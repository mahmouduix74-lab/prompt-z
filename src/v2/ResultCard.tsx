import React, { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { AppLang } from '../utils/i18n';

interface ResultCardProps {
  lang: AppLang;
  prompt: string;
  isLoading: boolean;
}

const action =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-400';

/** The prompt, laid out by its "# SECTION" headings, in black and white. */
const PromptText: React.FC<{ prompt: string }> = ({ prompt }) => {
  const blocks: { heading?: string; lines: string[] }[] = [];
  for (const line of prompt.split('\n')) {
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) blocks.push({ heading: heading[1], lines: [] });
    else if (blocks.length) blocks[blocks.length - 1].lines.push(line);
    else blocks.push({ lines: [line] });
  }
  return (
    <div dir="auto" className="flex flex-col gap-5">
      {blocks.map((b, i) => (
        <section key={i}>
          {b.heading && (
            <h3 className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500 dark:text-zinc-400" dir="ltr">
              {b.heading}
            </h3>
          )}
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-zinc-900 dark:text-zinc-100">{b.lines.join('\n').trim()}</p>
        </section>
      ))}
    </div>
  );
};

export const ResultCard: React.FC<ResultCardProps> = ({ lang, prompt, isLoading }) => {
  const isAr = lang === 'ar';
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the text can still be selected */
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([prompt], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `promptz-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <article
      aria-busy={isLoading}
      aria-live="polite"
      className="w-full rounded-[28px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 sm:p-7 text-start"
    >
      <header className="flex items-center justify-between gap-3 mb-5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{isAr ? 'البرومبت' : 'Your prompt'}</h2>
        {!isLoading && prompt && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={copy} className={action}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? (isAr ? 'اتنسخ' : 'Copied') : isAr ? 'نسخ' : 'Copy'}
            </button>
            <button type="button" onClick={download} className={action}>
              <Download className="w-4 h-4" />
              {isAr ? 'تحميل' : 'Download'}
            </button>
          </div>
        )}
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-3" role="status">
          <span className="sr-only">{isAr ? 'جارٍ كتابة البرومبت…' : 'Writing your prompt…'}</span>
          {[40, 92, 78, 30, 88, 64].map((w, i) => (
            <div key={i} className="h-3.5 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : (
        <PromptText prompt={prompt} />
      )}
    </article>
  );
};
