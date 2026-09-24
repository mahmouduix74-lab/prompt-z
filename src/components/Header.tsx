import React from 'react';
import { motion } from 'motion/react';
import { History, Sun, Moon, Languages } from 'lucide-react';
import { Theme, AppLang, UI_STRINGS } from '../utils/i18n';
import { Logo } from './Logo';
import { AccountMenu } from './AccountMenu';
import { AccountState } from '../services/account';

interface HeaderProps {
  activeModel?: string;
  savedCount?: number;
  theme: Theme;
  onToggleTheme: () => void;
  lang: AppLang;
  onToggleLang: () => void;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
  onScrollToBuilder?: () => void;
  onBookCall?: () => void;
  account?: AccountState | null;
}

const iconButtonClassName =
  'relative p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-all duration-150 cursor-pointer focus:outline-hidden';

export const Header: React.FC<HeaderProps> = ({
  savedCount = 0,
  theme,
  onToggleTheme,
  lang,
  onToggleLang,
  onOpenLibrary,
  onScrollToBuilder,
  account = null,
}) => {
  const t = UI_STRINGS[lang];
  const isAr = lang === 'ar';

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="sticky top-0 z-40 bg-transparent text-zinc-900 dark:text-white transition-colors duration-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 pb-2.5 sm:pt-7 sm:pb-3 flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo & Name: PromptZ */}
        <motion.button
          type="button"
          onClick={onScrollToBuilder}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          className="group cursor-pointer focus:outline-hidden transition-transform duration-150"
          title="PromptZ"
        >
          <Logo size="sm" lang={lang} />
        </motion.button>

        {/* Right Controls: Language, Theme Appearance */}
        <div className="flex items-center gap-1 sm:gap-2">
          <AccountMenu account={account} lang={lang} />

          {/* Language Toggle */}
          <motion.button
            type="button"
            onClick={onToggleLang}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-zinc-700 dark:text-zinc-200 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-all duration-150 cursor-pointer text-xs font-bold focus:outline-hidden"
            title={isAr ? 'Switch to English' : 'التحويل للعربية'}
            aria-label="Language"
          >
            <Languages className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className={isAr ? 'font-arabic font-bold text-sm leading-none' : 'font-mono uppercase text-[11px] font-bold leading-none'}>
              {isAr ? 'ع' : 'EN'}
            </span>
          </motion.button>

          {/* Theme Toggle (Light / Dark) */}
          <motion.button
            type="button"
            onClick={onToggleTheme}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className={iconButtonClassName}
            title={theme === 'dark' ? t.themeLight || 'Light Mode' : t.themeDark || 'Dark Mode'}
            aria-label="Appearance"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-700" />
            )}
          </motion.button>
        </div>
      </div>
    </motion.header>
  );
};
