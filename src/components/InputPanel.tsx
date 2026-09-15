import React, { useRef, useEffect, useState } from 'react';
import { AppLang, UI_STRINGS } from '../utils/i18n';
import { Sparkles, Trash2, ArrowUpLeft, ArrowUpRight, Loader2, Wand2, Undo2, PenLine } from 'lucide-react';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = UI_STRINGS[lang];
  const isBusy = isLoading || isEnhancing;

  // Auto resize main textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(280, textareaRef.current.scrollHeight)}px`;
    }
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
      {/* Header toolbar directly attached above text area - Perfectly aligned with Structured Prompt Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 min-h-[46px] border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/60 dark:bg-zinc-950/40 backdrop-blur-md rounded-t-2xl">
        <div className="flex items-center gap-2 text-xs">
          <PenLine className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
          <label htmlFor="raw-prompt" className="font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer">
            {lang === 'ar' ? 'فكرة أو متطلبات البرومبت' : 'Raw Prompt / Idea'}
          </label>
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

        {/* Prompt Enhancement Button: Elegant Secondary Styling with Sparkles Icon */}
        <button
          type="button"
          onClick={onEnhancePrompt}
          disabled={isBusy || !rawText.trim()}
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
        </button>
      </div>

      {/* Textarea with one-line typewriter animated placeholder */}
      <div className="relative flex-1 flex flex-col p-1">
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
          className="w-full flex-1 p-3.5 bg-transparent text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 resize-none focus:outline-none min-h-[380px] leading-relaxed relative z-20 font-sans"
          dir="auto"
        />
      </div>

      {/* Input Footer: Counts, Clear & Solid Purple Generate Button with Magic Wand Icon */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 min-h-[46px] border-t border-zinc-200/60 dark:border-zinc-800/60 bg-white/60 dark:bg-zinc-950/50 backdrop-blur-md rounded-b-2xl text-xs">
        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">
          <span>{charCount} {t.charCount}</span>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <span>{wordCount} {t.wordCount}</span>
        </div>

        <div className="flex items-center gap-2">
          {rawText.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              disabled={isBusy}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
              title={t.clear}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.clear}</span>
            </button>
          )}

          {/* Primary Filled Button: Pure Solid Purple (Non-linear) with Magic Wand Icon */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={isBusy || !rawText.trim()}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 active:bg-purple-800 dark:bg-purple-600 dark:hover:bg-purple-500 text-white text-xs font-semibold shadow-[0_4px_14px_rgba(124,58,237,0.35)] hover:shadow-[0_6px_20px_rgba(124,58,237,0.45)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Shortcut: Ctrl/Cmd + Enter"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t.generating}</span>
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5 text-white" />
                <span>{t.generate}</span>
                {lang === 'ar' ? (
                  <ArrowUpLeft className="w-3.5 h-3.5 opacity-75" />
                ) : (
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-75" />
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
