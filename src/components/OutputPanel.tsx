import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { EMPTY_TEMPLATE_PREVIEW } from '../constants';
import { copyToClipboard } from '../utils/clipboard';
import { AppLang, UI_STRINGS } from '../utils/i18n';
import {
  Copy,
  Check,
  Download,
  FileText,
  Sparkles,
  Terminal,
  Bookmark,
  CheckCircle2,
  FastForward,
  History,
} from 'lucide-react';
import { SnakeGame } from './SnakeGame';

interface OutputPanelProps {
  output: string;
  isLoading: boolean;
  timestamp?: number;
  lang: AppLang;
  theme?: 'light' | 'dark';
  onSaveToLibrary?: () => void;
  isSaved?: boolean;
  onOpenLibrary?: () => void;
  savedCount?: number;
}

type ViewMode = 'formatted' | 'raw' | 'sections';

/** Preview view: the prompt as written, with each "# TITLE" line drawn as a bold, highlighted heading. */
function renderWithHeadings(text: string): React.ReactNode {
  return text.split('\n').map((line, i, lines) => {
    const newline = i < lines.length - 1 ? '\n' : '';
    if (!line.startsWith('# ')) return <React.Fragment key={i}>{line + newline}</React.Fragment>;
    return (
      <React.Fragment key={i}>
        <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 text-sm sm:text-base font-extrabold tracking-wide">
          {line}
        </span>
        {newline}
      </React.Fragment>
    );
  });
}

export const OutputPanel: React.FC<OutputPanelProps> = ({
  output,
  isLoading,
  timestamp,
  lang,
  theme,
  onSaveToLibrary,
  isSaved = false,
  onOpenLibrary,
  savedCount = 0,
}) => {
  const [copied, setCopied] = useState(false);
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [copyFlash, setCopyFlash] = useState(false);
  const copyToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const copyFlashTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('formatted');
  const [displayedText, setDisplayedText] = useState<string>(output || '');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [newResultGlow, setNewResultGlow] = useState<boolean>(false);

  const prevOutputRef = useRef<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const t = UI_STRINGS[lang];
  const isAr = lang === 'ar';
  const hasResult = Boolean(output && output.trim());

  // Trigger subtle fade/glow highlight whenever a new result is generated
  useEffect(() => {
    if (output && output.trim()) {
      setNewResultGlow(true);
      const glowTimer = setTimeout(() => setNewResultGlow(false), 1400);
      return () => clearTimeout(glowTimer);
    }
  }, [output, timestamp]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (copyToastTimeoutRef.current) clearTimeout(copyToastTimeoutRef.current);
      if (copyFlashTimeoutRef.current) clearTimeout(copyFlashTimeoutRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Handle typing effect when a newly generated prompt arrives
  useEffect(() => {
    if (!output || !output.trim()) {
      setDisplayedText('');
      setIsTyping(false);
      prevOutputRef.current = '';
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    // Only trigger typing effect if output is new
    if (output !== prevOutputRef.current) {
      prevOutputRef.current = output;

      if (timerRef.current) clearInterval(timerRef.current);

      setIsTyping(true);
      setDisplayedText('');
      let currentIndex = 0;

      // Adaptive typing speed:
      // Types smoothly character-by-character (or in small character clusters for longer text)
      // to complete nicely in 1.4 - 2.2 seconds without lagging
      const totalLength = output.length;
      const step = Math.max(1, Math.ceil(totalLength / 110));
      const intervalMs = 18;

      timerRef.current = setInterval(() => {
        currentIndex += step;
        if (currentIndex >= totalLength) {
          setDisplayedText(output);
          setIsTyping(false);
          if (timerRef.current) clearInterval(timerRef.current);
        } else {
          setDisplayedText(output.slice(0, currentIndex));
        }
      }, intervalMs);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [output]);

  // Autoscroll to follow typewriter cursor as text streams
  useEffect(() => {
    if (isTyping && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [displayedText, isTyping]);

  const handleSkipTyping = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setDisplayedText(output);
    setIsTyping(false);
  };

  const handleCopy = async () => {
    if (!hasResult) return;
    handleSkipTyping();
    const success = await copyToClipboard(output);
    if (success) {
      setCopied(true);
      setShowCopyToast(true);
      setCopyFlash(true);

      if (copyToastTimeoutRef.current) clearTimeout(copyToastTimeoutRef.current);
      if (copyFlashTimeoutRef.current) clearTimeout(copyFlashTimeoutRef.current);

      copyFlashTimeoutRef.current = setTimeout(() => {
        setCopyFlash(false);
      }, 750);

      copyToastTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        setShowCopyToast(false);
      }, 2600);
    }
  };

  const handleDownload = () => {
    if (!hasResult) return;
    handleSkipTyping();
    const blob = new Blob([output], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `promptz-${dateStr}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const wordCount = hasResult ? output.trim().split(/\s+/).length : 0;
  const charCount = hasResult ? output.length : 0;

  // Split into structural sections if in 'sections' view
  const currentActiveText = isTyping ? displayedText : output;
  const parsedSections = useMemo(() => {
    if (!currentActiveText || !currentActiveText.trim()) return [];
    const lines = currentActiveText.split('\n');
    const sections: Array<{ title: string; content: string[] }> = [];
    let currentTitle = 'OVERVIEW';
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('# ')) {
        if (currentContent.length > 0 || currentTitle !== 'OVERVIEW') {
          sections.push({ title: currentTitle, content: currentContent });
        }
        currentTitle = line.replace('# ', '').trim();
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }
    if (currentContent.length > 0 || currentTitle !== 'OVERVIEW') {
      sections.push({ title: currentTitle, content: currentContent });
    }
    return sections;
  }, [currentActiveText]);

  return (
    <motion.div
      key={timestamp ? `output-panel-${timestamp}` : 'output-panel'}
      initial={timestamp ? { opacity: 0.85 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={`relative flex flex-col h-full rounded-2xl bg-white/70 dark:bg-zinc-900/50 backdrop-blur-xl overflow-hidden shadow-xs transition-shadow duration-700 ${
        newResultGlow ? 'shadow-[0_0_24px_rgba(168,85,247,0.18)]' : ''
      }`}
    >
      {/* Clean, Simple Output Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 min-h-[46px] bg-white/60 dark:bg-zinc-950/40 backdrop-blur-md border-b border-zinc-200/60 dark:border-zinc-800/60">
        <div className="flex items-center gap-2 text-xs">
          <Terminal className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {isAr ? 'البرومبت المهيكل' : 'Structured Prompt'}
          </span>

          {isTyping && (
            <div className="flex items-center gap-1.5 ml-2 rtl:ml-0 rtl:mr-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-[11px] text-purple-600 dark:text-purple-400 font-mono">
                {isAr ? 'جاري الكتابة...' : 'Streaming...'}
              </span>
              <button
                type="button"
                onClick={handleSkipTyping}
                className="text-[10px] px-1.5 py-0.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer inline-flex items-center gap-0.5"
                title={isAr ? 'إظهار فوراً' : 'Skip typing effect'}
              >
                <FastForward className="w-2.5 h-2.5" />
                <span>{isAr ? 'تخطي' : 'Skip'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Action Controls & View Mode */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher */}
          {hasResult && (
            <div className="flex items-center p-0.5 rounded-lg bg-zinc-100/90 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 text-[11px]">
              <button
                type="button"
                onClick={() => setViewMode('formatted')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'formatted'
                    ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 font-semibold shadow-2xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {isAr ? 'منسق' : 'Preview'}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'raw'
                    ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 font-semibold shadow-2xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {isAr ? 'نص' : 'Raw'}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('sections')}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'sections'
                    ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 font-semibold shadow-2xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {isAr ? 'أقسام' : 'Blocks'}
              </button>
            </div>
          )}

          {/* Action Buttons: Save, Copy, Download */}
          <div className="flex items-center gap-1.5">
            {onSaveToLibrary && (
              <button
                type="button"
                onClick={() => {
                  handleSkipTyping();
                  onSaveToLibrary();
                }}
                disabled={!hasResult || isLoading}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  hasResult && !isLoading
                    ? isSaved
                      ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20'
                      : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 cursor-pointer shadow-2xs'
                    : 'bg-zinc-100/50 dark:bg-zinc-900/50 text-zinc-400 dark:text-zinc-600 cursor-not-allowed border border-zinc-200/60 dark:border-zinc-800/40 opacity-50'
                }`}
                title={isAr ? 'حفظ في المكتبة' : 'Save to Library'}
              >
                <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                <span className="hidden sm:inline">
                  {isSaved ? (isAr ? 'محفوظ' : 'Saved') : (isAr ? 'حفظ' : 'Save')}
                </span>
              </button>
            )}

            <motion.button
              whileTap={{ scale: 0.94 }}
              type="button"
              onClick={handleCopy}
              disabled={!hasResult || isLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                hasResult && !isLoading
                  ? copied
                    ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs cursor-pointer'
                    : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white cursor-pointer shadow-xs'
                  : 'bg-zinc-100/50 dark:bg-zinc-900/50 text-zinc-400 dark:text-zinc-600 cursor-not-allowed border border-zinc-200/60 dark:border-zinc-800/40 opacity-50'
              }`}
              title={t.copy}
            >
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span
                    key="copied-active"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{t.copied}</span>
                  </motion.span>
                ) : (
                  <motion.span
                    key="copy-idle"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="flex items-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t.copy}</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!hasResult || isLoading}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                hasResult && !isLoading
                  ? 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 cursor-pointer shadow-2xs'
                  : 'bg-zinc-100/50 dark:bg-zinc-900/50 text-zinc-400 dark:text-zinc-600 cursor-not-allowed border border-zinc-200/60 dark:border-zinc-800/40 opacity-50'
              }`}
              title={t.downloadMd}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.downloadMd}</span>
            </button>

            {/* History / Library Icon Button */}
            {onOpenLibrary && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={onOpenLibrary}
                className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 cursor-pointer shadow-2xs transition-all border border-zinc-200/60 dark:border-zinc-800/60"
                title={t.library || (isAr ? 'السجل والمكتبة' : 'History & Saved')}
                aria-label={t.library || (isAr ? 'السجل والمكتبة' : 'History & Saved')}
              >
                <History className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span className="hidden sm:inline">
                  {isAr ? 'السجل' : 'History'}
                </span>
                {savedCount > 0 && (
                  <span className="min-w-[15px] h-3.5 px-1 rounded-full text-[9px] font-mono font-bold bg-[#7C3AED] text-white flex items-center justify-center shadow-2xs">
                    {savedCount}
                  </span>
                )}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Main Output Content Area */}
      <div
        ref={scrollContainerRef}
        className={`relative flex-1 p-4 bg-white/20 dark:bg-zinc-950/40 overflow-y-auto min-h-[380px] text-xs sm:text-sm font-mono leading-relaxed select-text flex flex-col transition-all duration-500 ${
          copyFlash
            ? 'ring-2 ring-emerald-500/40 dark:ring-emerald-400/30 bg-emerald-500/[0.04]'
            : ''
        }`}
      >
        {/* Loading / Thinking Overlay with Animated Ghost Laptop Character & Playable Snake Game */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              key="output-loading-overlay"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md z-20 text-zinc-700 dark:text-zinc-200 overflow-y-auto"
            >
              {/* Playable Snake Arcade Game while waiting */}
              <SnakeGame lang={lang} isAr={isAr} theme={theme} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Smooth Subtle Fade-in on new output result */}
        <AnimatePresence mode="wait">
          {hasResult ? (
            <motion.div
              key={timestamp ? `output-${timestamp}` : output ? `output-${output.slice(0, 30)}` : 'output-view'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col"
            >
              {viewMode === 'sections' ? (
                /* Sections block breakdown view */
                <div dir="ltr" className="space-y-3">
                  {parsedSections.map((sec, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: idx * 0.04 }}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 p-3.5"
                    >
                      <div className="text-sm font-extrabold font-mono tracking-wide text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                        <span># {sec.title}</span>
                      </div>
                      <div className="text-xs font-mono text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                        {sec.content.join('\n').trim()}
                      </div>
                    </motion.div>
                  ))}
                  {isTyping && (
                    <div className="flex items-center gap-1 text-xs text-purple-500 font-mono">
                      <span className="inline-block w-2 h-3.5 bg-purple-600 dark:bg-purple-400 animate-pulse rounded-xs" />
                    </div>
                  )}
                </div>
              ) : (
                /* Standard formatted or raw view with character typewriter & terminal cursor */
                <div
                  dir="ltr"
                  className={`flex-1 text-left whitespace-pre-wrap break-words font-mono text-xs sm:text-sm leading-relaxed select-all selection:bg-purple-500/20 dark:selection:bg-purple-500/40 ${
                    viewMode === 'raw'
                      ? 'text-zinc-700 dark:text-zinc-300 font-mono'
                      : 'text-zinc-900 dark:text-zinc-100 font-mono'
                  }`}
                >
                  {viewMode === 'raw' ? currentActiveText : renderWithHeadings(currentActiveText)}
                  {isTyping && (
                    <span
                      className="inline-block w-2 h-4 ml-0.5 bg-purple-600 dark:bg-purple-400 animate-pulse align-middle rounded-xs"
                      aria-hidden="true"
                    />
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            /* Empty Template Guide */
            <motion.div
              key="empty-guide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ duration: 0.3 }}
              dir="ltr"
              className="flex-1 text-left whitespace-pre-wrap break-words text-zinc-400 dark:text-zinc-600 font-mono text-xs sm:text-sm leading-relaxed select-none"
            >
              {EMPTY_TEMPLATE_PREVIEW}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Output Footer / Metadata Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-white/50 dark:bg-zinc-950/40 backdrop-blur-md border-t border-white/60 dark:border-zinc-800/60 text-[11px] font-mono text-zinc-500">
        <div className="flex items-center gap-2 flex-wrap">
          {hasResult ? (
            <>
              <span>{charCount} {t.charCount}</span>
              <span>•</span>
              <span>{wordCount} {t.wordCount}</span>
            </>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500 font-sans">
              {t.emptyTemplateNotice}
            </span>
          )}
        </div>

        {hasResult && timestamp && (
          <div className="flex items-center gap-1.5 text-zinc-500 font-sans">
            <FileText className="w-3 h-3" />
            <span>{new Date(timestamp).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US')}</span>
          </div>
        )}
      </div>

      {/* Visual Feedback Toast Notification when copying prompt */}
      <AnimatePresence>
        {showCopyToast && (
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 440, damping: 26 }}
            className="absolute bottom-14 sm:bottom-16 inset-x-0 mx-auto w-fit max-w-[92%] z-50 pointer-events-auto"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-zinc-950/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-emerald-500/40 text-white shadow-[0_16px_40px_rgba(0,0,0,0.45),0_0_25px_rgba(16,185,129,0.22)] ring-1 ring-emerald-400/20">
              <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <Check className="w-4 h-4 stroke-[2.5]" />
              </span>

              <div className="flex flex-col text-left rtl:text-right">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-zinc-100">
                    {isAr ? 'تم نسخ البرومبت بنجاح!' : 'Prompt Copied to Clipboard!'}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {wordCount} {t.wordCount}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400 font-normal leading-tight mt-0.5">
                  {isAr
                    ? 'جاهز للصق في ChatGPT أو Claude أو Gemini'
                    : 'Ready to paste into ChatGPT, Claude, or Gemini'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowCopyToast(false)}
                className="text-zinc-400 hover:text-zinc-200 text-xs p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer ml-1 rtl:ml-0 rtl:mr-1"
                aria-label="Dismiss toast"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
