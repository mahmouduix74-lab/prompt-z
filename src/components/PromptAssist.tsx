import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, HelpCircle, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { EASE, Modal } from './Modal';
import { AppLang } from '../utils/i18n';
import type { ClarifyingQuestion } from '../prompting';

const primaryButton =
  'inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400';
const quietButton =
  'inline-flex items-center justify-center h-9 px-3 rounded-xl text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400';

interface ClarifyDialogProps {
  open: boolean;
  lang: AppLang;
  questions: ClarifyingQuestion[];
  isLoading: boolean;
  /** Called with the answered questions as "question answer" lines (empty when skipped). */
  onSubmit: (answers: string[]) => void;
  onClose: () => void;
}

/** Popup with optional questions asked when a request is too vague; answers are added to the request. */
export const ClarifyDialog: React.FC<ClarifyDialogProps> = ({ open, lang, questions, isLoading, onSubmit, onClose }) => {
  const isAr = lang === 'ar';
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''));

  useEffect(() => setAnswers(questions.map(() => '')), [questions]);

  const setAnswer = (i: number, value: string) => setAnswers((prev) => prev.map((a, n) => (n === i ? value : a)));
  const answered = questions
    .map((q, i) => (answers[i]?.trim() ? `${q.question} ${answers[i].trim()}` : ''))
    .filter(Boolean);

  return (
    <Modal open={open} lang={lang} labelledBy="clarify-title" onClose={onClose} size="md">
      <div className="flex flex-col items-center text-center mb-6">
        <span className="w-12 h-12 rounded-2xl bg-purple-500/10 inline-flex items-center justify-center">
          <HelpCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        </span>
        <h2 id="clarify-title" className="mt-4 text-xl font-bold">
          {isAr ? 'سؤال سريع لبرومبت أدق' : 'A quick question for a sharper prompt'}
        </h2>
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          {isAr ? 'طلبك ينقصه بعض التفاصيل. أجب عمّا تريد، أو تخطَّ.' : 'Your request is missing a few details. Answer what you like, or skip.'}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {questions.map((q, i) => (
          <fieldset key={i} className="flex flex-col gap-2.5">
            <legend className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2.5">{q.question}</legend>
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
                      className={`h-9 px-3.5 rounded-full text-sm border transition-colors duration-150 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400 ${
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
              value={q.options.includes(answers[i]) ? '' : answers[i] || ''}
              onChange={(e) => setAnswer(i, e.target.value)}
              placeholder={isAr ? 'أو اكتب إجابتك' : 'Or type your answer'}
              aria-label={`${q.question} ${isAr ? '(إجابة أخرى)' : '(other answer)'}`}
              className="h-11 px-4 rounded-2xl text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/60 focus:border-purple-500"
            />
          </fieldset>
        ))}
      </div>

      <div className="flex flex-col gap-2 mt-7">
        <button
          type="button"
          disabled={isLoading || !answered.length}
          onClick={() => onSubmit(answered)}
          className="w-full h-12 px-4 rounded-2xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        >
          {isAr ? 'ولّد بالإجابات' : 'Generate with answers'}
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onSubmit([])}
          className="w-full h-12 px-4 rounded-2xl text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          {isAr ? 'تخطَّ وولّد' : 'Skip and generate'}
        </button>
      </div>
    </Modal>
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
  const [choice, setChoice] = useState<'up' | 'down' | null>(null);
  const [state, setState] = useState<'ask' | 'comment' | 'sending' | 'done'>('ask');
  const [comment, setComment] = useState('');

  const send = async (rating: 'up' | 'down', note = '') => {
    setChoice(rating);
    setState('sending');
    await onSend(rating, note);
    setState('done');
  };

  const pill = (kind: 'up' | 'down') => {
    const active = choice === kind;
    const tone =
      kind === 'up'
        ? active
          ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/25'
          : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:text-emerald-300 dark:hover:bg-emerald-500/10'
        : active
          ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/25'
          : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:text-rose-300 dark:hover:bg-rose-500/10';
    return `inline-flex items-center gap-2 h-10 px-4 rounded-full border text-sm font-semibold transition-colors duration-150 cursor-pointer disabled:cursor-default focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400 ${tone}`;
  };

  return (
    <div
      className={`flex flex-col gap-3 p-4 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md shadow-xs ${isAr ? 'font-arabic' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AnimatePresence mode="wait" initial={false}>
          {state === 'done' ? (
            <motion.p
              key="thanks"
              role="status"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              {isAr ? 'شكرًا، رأيك يساعدنا نحسّن البرومبتات.' : 'Thanks, your feedback helps us improve.'}
            </motion.p>
          ) : (
            <motion.p key="ask" exit={{ opacity: 0 }} className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              {isAr ? 'هل البرومبت مفيد؟' : 'Was this prompt useful?'}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            whileHover={{ scale: choice ? 1 : 1.05 }}
            whileTap={{ scale: 0.9 }}
            animate={choice === 'up' ? { scale: [1, 1.18, 1] } : { scale: 1 }}
            transition={{ duration: 0.35, ease: EASE }}
            className={pill('up')}
            disabled={state !== 'ask' && state !== 'comment'}
            onClick={() => send('up')}
            aria-pressed={choice === 'up'}
          >
            <ThumbsUp className="w-4 h-4" />
            {isAr ? 'مفيد' : 'Useful'}
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: choice ? 1 : 1.05 }}
            whileTap={{ scale: 0.9 }}
            animate={choice === 'down' || state === 'comment' ? { scale: [1, 1.18, 1] } : { scale: 1 }}
            transition={{ duration: 0.35, ease: EASE }}
            className={pill('down')}
            disabled={state === 'sending' || state === 'done'}
            onClick={() => {
              setChoice('down');
              setState('comment');
            }}
            aria-pressed={choice === 'down'}
            aria-expanded={state === 'comment'}
          >
            <ThumbsDown className="w-4 h-4" />
            {isAr ? 'غير مفيد' : 'Not useful'}
          </motion.button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {(state === 'comment' || (state === 'sending' && choice === 'down')) && (
          <motion.form
            key="comment"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="flex flex-col sm:flex-row gap-2 overflow-hidden"
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
              className="w-full sm:flex-1 h-10 shrink-0 px-4 rounded-xl text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-purple-500/60 focus:border-purple-500"
            />
            <button type="submit" disabled={state === 'sending'} className={`${primaryButton} h-10`}>
              {state === 'sending' ? (isAr ? 'جاري الإرسال...' : 'Sending...') : isAr ? 'إرسال' : 'Send'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
};
