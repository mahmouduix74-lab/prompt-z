import React from 'react';
import { motion } from 'motion/react';
import { AppLang } from '../utils/i18n';
import { PromptZIcon } from './Logo';

interface FooterProps {
  lang: AppLang;
  onOpenLibrary: () => void;
  savedCount: number;
}

export const Footer: React.FC<FooterProps> = ({
  lang,
  onOpenLibrary,
  savedCount,
}) => {
  const isAr = lang === 'ar';

  return (
    <motion.footer
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md py-6 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Brand: PromptZ Vector Logo & Name */}
        <div className="flex items-center gap-2">
          <PromptZIcon sizeClass="w-8 h-8" />
          <span
            className="text-lg font-[800] tracking-[-0.025em] text-[#181622] dark:text-white select-none"
            style={{ fontFamily: "'Montserrat', system-ui, -apple-system, sans-serif" }}
          >
            Prompt<span className="text-[#7132F5] dark:text-[#8B5CF6]">Z</span>
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 ms-1">
            {isAr
              ? '• استوديو صياغة وهندسة البرومبتات الاحترافية'
              : '• Precision AI Prompt Engineering Studio'}
          </span>
        </div>

        {/* Status & Quick Links */}
        <div className="flex items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
          <button
            type="button"
            onClick={onOpenLibrary}
            className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
          >
            {isAr ? `المكتبة (${savedCount})` : `Library (${savedCount})`}
          </button>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] text-zinc-500">Gemini Active</span>
          </div>
        </div>
      </div>
    </motion.footer>
  );
};
