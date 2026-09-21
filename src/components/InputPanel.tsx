import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLang, UI_STRINGS } from '../utils/i18n';
import { Sparkles, Trash2, ArrowUpLeft, ArrowUpRight, Loader2, Wand2, Undo2, PenLine, Info } from 'lucide-react';

interface InputPanelProps {
  rawText: string;
  onChangeText: (text: string) => void;
  exclusions?: string;
  onChangeExclusions?: (exclusions: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  onEnhancePrompt: () => void;
  isEnhancing: boolean;
  canUndoEnhance?: boolean;
  onUndoEnhance?: () => void;
  isLoading: boolean;
  lang: AppLang;
}

const PROMPT_PLACEHOLDERS_AR = [
  'مثال: صياغة برومبت تفصيلي لبناء تطبيق SaaS متكامل بـ React و Node.js...',
  'مثال: إنشاء استراتيجية تسويق رقمي وإعلانات موجهة للشركات الناشئة...',
  'مثال: تحليل بيانات المبيعات وتحديد مؤشرات الأداء الرئيسية والأنماط التكرارية...',
  'مثال: كتابة كود بايثون متقدم لمعالجة البيانات مع اختبارات أداء شاملة...',
  'مثال: تصميم بنية تحتية سحابية آمنة قابلة للتوسع مع معايير الحماية الكاملة...',
];

const PROMPT_PLACEHOLDERS_EN = [
  'e.g., Design a full-stack SaaS analytics dashboard using React & TypeScript...',
  'e.g., Create an enterprise SEO & content strategy for a B2B product...',
  'e.g., Build a scalable Python microservice with Redis caching & Docker...',
  'e.g., Formulate a customer onboarding workflow with UX best practices...',
  'e.g., Architect a modern multi-tenant cloud database schema with security rules...',
];

/**
 * Animated one-line typewriter placeholder matching the hero typewriter motion
 */
const AnimatedPromptPlaceholder: React.FC<{
  lines: readonly string[];
  onClick?: () => void;
}> = ({ lines, onClick }) => {
  const [lineIndex, setLineIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pause, setPause] = useState(false);

  useEffect(() => {
    if (!lines || lines.length === 0) return;
    const currentLine = lines[lineIndex % lines.length];
    const characters = Array.from(currentLine);

    if (pause) {
      const pauseTimer = setTimeout(() => {
        setPause(false);
        setIsDeleting(true);
      }, 2200);
      return () => clearTimeout(pauseTimer);
    }

    if (!isDeleting && subIndex === characters.length) {
      setPause(true);
      return;
    }

    if (isDeleting && subIndex === 0) {
      setIsDeleting(false);
      setLineIndex((prev) => (prev + 1) % lines.length);
      return;
    }

    const timer = setTimeout(
      () => {
        setSubIndex((prev) => prev + (isDeleting ? -1 : 1));
      },
      isDeleting ? 22 : 45
    );

    return () => clearTimeout(timer);
  }, [subIndex, isDeleting, pause, lineIndex, lines]);

  // Reset when language lines change
  useEffect(() => {
    setLineIndex(0);
    setSubIndex(0);
    setIsDeleting(false);
    setPause(false);
  }, [lines]);

  const currentLine = lines[lineIndex % lines.length] || '';
  const currentChars = Array.from(currentLine).slice(0, subIndex).join('');

  return (
    <div
      onClick={onClick}
      className="absolute top-4 inset-x-4 pointer-events-none select-none text-sm text-zinc-400/90 dark:text-zinc-500 overflow-hidden text-ellipsis whitespace-nowrap flex items-center z-10"
      aria-hidden="true"
    >
      <span className="truncate">{currentChars}</span>
      <span className="inline-block w-[2px] h-[1.1em] mx-1 bg-purple-500/80 dark:bg-purple-400 rounded-full animate-pulse shrink-0" />
    </div>
  );
};

export const InputPanel: React.FC<InputPanelProps> = ({
  rawText,
  onChangeText,
  onSubmit,
  onClear,
  onEnhancePrompt,
  isEnhancing,
  canUndoEnhance,
  onUndoEnhance,
  isLoading,
  lang,
}) => {
  const [showTips, setShowTips] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = UI_STRINGS[lang];
  const isBusy = isLoading || isEnhancing;

  // Keep the current 380px minimum; once the text needs more room the box grows to hug it
  useEffect(() => {
    const resize = () => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.max(380, el.scrollHeight)}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [rawText]);

  // Handle Ctrl+Enter / Cmd+Enter shortcut
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isBusy && rawText.trim()) {
        onSubmit();
      }
    }
  };

  const charCount = rawText.length;
  const wordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
  const placeholderLines = lang === 'ar' ? PROMPT_PLACEHOLDERS_AR : PROMPT_PLACEHOLDERS_EN;

  return (
    <div className="relative flex flex-col h-full rounded-2xl bg-white/70 dark:bg-zinc-900/50 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 focus-within:border-purple-500/70 focus-within:ring-1 focus-within:ring-purple-500/30 shadow-xs transition-all overflow-hidden">
      {/* Header toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 min-h-[48px] border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/60 dark:bg-zinc-950/40 backdrop-blur-md rounded-t-2xl">
        <div className="flex items-center gap-2 text-xs">
          <PenLine className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
          <label htmlFor="raw-prompt" className="font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer">
            {lang === 'ar' ? 'فكرة أو متطلبات البرومبت' : 'Raw Prompt / Idea'}
          </label>

          {/* Quick Tips Help Popover Icon */}
          <div className="relative inline-flex items-center">
            <button
              type="button"
              onMouseEnter={() => setShowTips(true)}
              onMouseLeave={() => setShowTips(false)}
              onClick={() => setShowTips((prev) => !prev)}
              onFocus={() => setShowTips(true)}
              onBlur={() => setShowTips(false)}
              className="p-1 rounded-full text-zinc-400 hover:text-purple-600 dark:text-zinc-500 dark:hover:text-purple-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer focus:outline-hidden"
              title={lang === 'ar' ? 'نصائح لكتابة برومبت فعال' : 'Tips for effective prompts'}
              aria-label="Prompting Tips Help"
            >
              <Info className="w-3.5 h-3.5" />
            </button>

            <AnimatePresence>
              {showTips && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  className={`absolute top-full mt-2.5 z-50 w-64 sm:w-72 p-3.5 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200/90 dark:border-zinc-800/90 shadow-xl text-xs text-zinc-700 dark:text-zinc-300 pointer-events-none select-none ${
                    lang === 'ar' ? 'start-0 text-right font-arabic' : 'start-0 text-left'
                  }`}
                >
                  {/* Tooltip Arrow pointing up to Info icon */}
                  <div
                    className={`absolute -top-1.5 w-3 h-3 rotate-45 bg-white/95 dark:bg-zinc-900/95 border-t border-s border-zinc-200/90 dark:border-zinc-800/90 ${
                      lang === 'ar' ? 'start-3' : 'start-3'
                    }`}
                  />

                  <div className="relative z-10">
                    <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100 mb-2.5 border-b border-zinc-100 dark:border-zinc-800/80 pb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>{lang === 'ar' ? 'نصائح لبرومبت فعال' : 'Tips for Effective Prompts'}</span>
                    </div>
                    <ul className="space-y-2 text-[11px] leading-relaxed">
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 dark:text-purple-400 font-bold shrink-0 mt-0.5">•</span>
                        <div>
                          <strong className="font-semibold text-zinc-900 dark:text-zinc-200">
                            {lang === 'ar' ? 'كن محددًا:' : 'Be specific:'}
                          </strong>{' '}
                          {lang === 'ar'
                            ? 'اصف الهدف الأساسي والوظائف المطلوبة بدقة.'
                            : 'State your core goal and details clearly.'}
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 dark:text-purple-400 font-bold shrink-0 mt-0.5">•</span>
                        <div>
                          <strong className="font-semibold text-zinc-900 dark:text-zinc-200">
                            {lang === 'ar' ? 'حدّد السياق:' : 'Define context:'}
                          </strong>{' '}
                          {lang === 'ar'
                            ? 'اذكر الجمهور المستهدف أو التقنيات المستخدمة.'
                            : 'Specify target audience or stack constraints.'}
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 dark:text-purple-400 font-bold shrink-0 mt-0.5">•</span>
                        <div>
                          <strong className="font-semibold text-zinc-900 dark:text-zinc-200">
                            {lang === 'ar' ? 'حدّد شكل المخرجات:' : 'Include output format:'}
                          </strong>{' '}
                          {lang === 'ar'
                            ? 'اذكر التنسيق المطلوب (خطوات، كود، جداول).'
                            : 'Mention structure (e.g., bullets, code, table).'}
                        </div>
                      </li>
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {canUndoEnhance && onUndoEnhance && (
            <button
              type="button"
              onClick={onUndoEnhance}
              disabled={isBusy}
              className="flex items-center gap-1 text-[11px] font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 hover:underline cursor-pointer ms-1.5"
              title={t.undoEnhance}
            >
              <Undo2 className="w-3 h-3" />
              <span>{t.undoEnhance}</span>
            </button>
          )}
        </div>

        {/* Prompt Enhancement Button in Toolbar */}
        <motion.button
          type="button"
          onClick={onEnhancePrompt}
          disabled={isBusy || !rawText.trim()}
          whileHover={isBusy || !rawText.trim() ? {} : { scale: 1.03 }}
          whileTap={isBusy || !rawText.trim() ? {} : { scale: 0.97 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100/90 hover:bg-purple-50/80 dark:bg-zinc-800/80 dark:hover:bg-purple-950/40 text-zinc-700 hover:text-purple-700 dark:text-zinc-300 dark:hover:text-purple-300 border border-zinc-200/80 hover:border-purple-300/80 dark:border-zinc-700/80 dark:hover:border-purple-500/40 shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title={t.enhancePromptTooltip}
        >
          {isEnhancing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600 dark:text-purple-400" />
              <span>{t.enhancingPrompt}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>{t.enhancePrompt}</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Textarea with one-line typewriter animated placeholder & centered empty character watermark */}
      <div className="relative flex-1 flex flex-col p-1 cursor-text" onClick={() => textareaRef.current?.focus()}>
        {!rawText && (
          <AnimatedPromptPlaceholder
            lines={placeholderLines}
            onClick={() => textareaRef.current?.focus()}
          />
        )}

        <textarea
          id="raw-prompt"
          ref={textareaRef}
          value={rawText}
          onChange={(e) => onChangeText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isBusy}
          className="w-full flex-none p-3.5 bg-transparent text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 resize-none overflow-hidden focus:outline-none min-h-[380px] leading-relaxed relative z-20 font-sans"
          dir="auto"
        />
      </div>

      {/* Input Footer: Counts, Clear & Solid Purple Generate Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-2 px-4 py-3 border-t border-zinc-200/60 dark:border-zinc-800/60 bg-white/60 dark:bg-zinc-950/50 backdrop-blur-md rounded-b-2xl text-xs">
        {/* Character & Word Count - Stacked cleanly above action buttons on mobile */}
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-mono text-[11px] pb-1 sm:pb-0 border-b sm:border-b-0 border-zinc-200/40 dark:border-zinc-800/40">
          <span>{charCount} {t.charCount}</span>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <span>{wordCount} {t.wordCount}</span>
        </div>

        <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto">
          {rawText.length > 0 && (
            <motion.button
              type="button"
              onClick={onClear}
              disabled={isBusy}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50 text-xs font-medium"
              title={t.clear}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.clear}</span>
            </motion.button>
          )}

          {/* Primary Action Button: Solid Purple Generate Button (48px Height, Single Icon) */}
          <motion.button
            type="button"
            onClick={onSubmit}
            disabled={isBusy || !rawText.trim()}
            whileHover={isBusy || !rawText.trim() ? {} : { scale: 1.03 }}
            whileTap={isBusy || !rawText.trim() ? {} : { scale: 0.96 }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 sm:px-8 h-[48px] min-h-[48px] rounded-2xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-500 text-white text-sm font-bold shadow-[0_6px_20px_rgba(124,58,237,0.38)] hover:shadow-[0_8px_25px_rgba(124,58,237,0.5)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title="Shortcut: Ctrl/Cmd + Enter"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t.generating}</span>
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5 text-white" />
                <span>{t.generate}</span>
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
};
