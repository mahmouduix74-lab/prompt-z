import React, { useEffect, useState } from 'react';
import { HelpCircle, RefreshCw, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { AppLang } from '../utils/i18n';
import type { ClarifyingQuestion } from '../prompting';

const primaryButton =
  'inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400';
const quietButton =
  'inline-flex items-center justify-center h-9 px-3 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400';

interface ClarifyPanelProps {
  lang: AppLang;
  questions: ClarifyingQuestion[];
  isLoading: boolean;
  /** Called with the answered questions as "question: answer" lines (empty when skipped). */
  onSubmit: (answers: string[]) => void;
  onDismiss: () => void;
}

/** Optional questions asked when a request is too vague; answers are added to the request. */
export const ClarifyPanel: React.FC<ClarifyPanelProps> = ({ lang, questions, isLoading, onSubmit, onDismiss }) => {
  const isAr = lang === 'ar';
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''));

  useEffect(() => setAnswers(questions.map(() => '')), [questions]);

  const setAnswer = (i: number, value: string) => setAnswers((prev) => prev.map((a, n) => (n === i ? value : a)));
  const answered = questions
    .map((q, i) => (answers[i].trim() ? `${q.question} ${answers[i].trim()}` : ''))
    .filter(Boolean);

  return (
    <section
      aria-labelledby="clarify-title"
      className={`relative p-4 sm:p-5 rounded-2xl bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-purple-500/25 shadow-lg shadow-purple-950/5 ${isAr ? 'font-arabic' : ''}`}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label={isAr ? 'إغلاق' : 'Close'}
        className="absolute top-3 end-3 p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3 mb-4 pe-8">
        <span className="w-9 h-9 shrink-0 rounded-xl bg-purple-500/10 inline-flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </span>
        <div>
          <h2 id="clarify-title" className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {isAr ? 'سؤال سريع لبرومبت أدق' : 'A quick question for a sharper prompt'}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {isAr ? 'طلبك ينقصه بعض التفاصيل. أجب عمّا تريد، أو تخطَّ.' : 'Your request is missing a few details. Answer what you like, or skip.'}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {questions.map((q, i) => (
          <fieldset key={i} className="flex flex-col gap-2">
            <legend className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">{q.question}</legend>
            {q.options.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {q.options.map((option) => {
                  const selected = answers[i] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setAnswer(i, selected ? '' : option)}
                      className={`h-8 px-3 rounded-full text-sm border transition-colors duration-150 cursor-pointer ${
                        selected
                          ? 'bg-purple-600 border-purple-600 text-white'
                          : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-purple-400'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            )}
            <input
              type="text"
              value={q.options.includes(answers[i]) ? '' : answers[i]}
              onChange={(e) => setAnswer(i, e.target.value)}
              placeholder={isAr ? 'أو اكتب إجابتك' : 'Or type your answer'}
              aria-label={`${q.question} ${isAr ? '(إجابة أخرى)' : '(other answer)'}`}
              className="h-9 px-3 rounded-xl text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-purple-500/60"
            />
          </fieldset>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-5">
        <button type="button" disabled={isLoading || !answered.length} onClick={() => onSubmit(answered)} className={primaryButton}>
          {isAr ? 'ولّد بالإجابات' : 'Generate with answers'}
        </button>
        <button type="button" disabled={isLoading} onClick={() => onSubmit([])} className={quietButton}>
          {isAr ? 'تخطَّ وولّد' : 'Skip and generate'}
        </button>
      </div>
    </section>
  );
};

interface ServiceNoticeProps {
  lang: AppLang;
  isLoading: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

/** The model is busy or down: say so plainly and offer a retry. */
export const ServiceNotice: React.FC<ServiceNoticeProps> = ({ lang, isLoading, onRetry, onDismiss }) => {
  const isAr = lang === 'ar';
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10 backdrop-blur-md border border-amber-500/25 text-sm text-amber-900 dark:text-amber-200 ${isAr ? 'font-arabic' : ''}`}
    >
      <span>
        {isAr
          ? 'خدمة الذكاء الاصطناعي مشغولة الآن، ولم يُحتسب هذا الطلب من رصيدك. حاول مرة أخرى بعد لحظات.'
          : 'The AI service is busy right now, and this request was not counted. Please try again in a moment.'}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onRetry} disabled={isLoading} className={primaryButton}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isAr ? 'حاول مرة أخرى' : 'Try again'}
        </button>
        <button type="button" onClick={onDismiss} className={quietButton}>
          {isAr ? 'إغلاق' : 'Dismiss'}
        </button>
      </div>
    </div>
  );
};

interface FeedbackBarProps {
  lang: AppLang;
  onSend: (rating: 'up' | 'down', comment: string) => Promise<boolean>;
}

/** 👍 / 👎 under a generated prompt, with an optional note on 👎. Remount it for each new prompt. */
export const FeedbackBar: React.FC<FeedbackBarProps> = ({ lang, onSend }) => {
  const isAr = lang === 'ar';
  const [state, setState] = useState<'ask' | 'comment' | 'sending' | 'done'>('ask');
  const [comment, setComment] = useState('');

  const send = async (rating: 'up' | 'down', note = '') => {
    setState('sending');
    await onSend(rating, note);
    setState('done');
  };

  if (state === 'done') {
    return (
      <p role="status" className={`text-sm text-zinc-600 dark:text-zinc-400 ${isAr ? 'font-arabic' : ''}`}>
        {isAr ? 'شكرًا، رأيك يساعدنا نحسّن البرومبتات.' : 'Thanks, your feedback helps us improve.'}
      </p>
    );
  }

  const thumb =
    'inline-flex items-center justify-center w-9 h-9 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer disabled:opacity-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400';

  return (
    <div className={`flex flex-col gap-3 ${isAr ? 'font-arabic' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{isAr ? 'هل البرومبت مفيد؟' : 'Was this prompt useful?'}</span>
        <button type="button" className={thumb} disabled={state === 'sending'} onClick={() => send('up')} aria-label={isAr ? 'مفيد' : 'Useful'}>
          <ThumbsUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          className={`${thumb} ${state === 'comment' ? 'border-purple-500 text-purple-600' : ''}`}
          disabled={state === 'sending'}
          onClick={() => setState('comment')}
          aria-label={isAr ? 'غير مفيد' : 'Not useful'}
          aria-expanded={state === 'comment'}
        >
          <ThumbsDown className="w-4 h-4" />
        </button>
      </div>
      {(state === 'comment' || (state === 'sending' && comment)) && (
        <form
          className="flex flex-col sm:flex-row gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send('down', comment);
          }}
        >
          <label htmlFor="feedback-comment" className="sr-only">
            {isAr ? 'ما الذي لم يعجبك؟' : 'What was wrong?'}
          </label>
          <input
            id="feedback-comment"
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            placeholder={isAr ? 'ما الذي لم يعجبك؟ (اختياري)' : 'What was wrong? (optional)'}
            className="flex-1 h-9 px-3 rounded-xl text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-purple-500/60"
          />
          <button type="submit" disabled={state === 'sending'} className={primaryButton}>
            {isAr ? 'إرسال' : 'Send'}
          </button>
        </form>
      )}
    </div>
  );
};
