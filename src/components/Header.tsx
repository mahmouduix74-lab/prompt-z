import React from 'react';
import { History, Sun, Moon, Languages, Settings } from 'lucide-react';
import { Theme, AppLang, UI_STRINGS } from '../utils/i18n';
import { Logo } from './Logo';

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
  onOpenSettings,
  onScrollToBuilder,
}) => {
  const t = UI_STRINGS[lang];
  const isAr = lang === 'ar';

  return (
    <header className="sticky top-0 z-40 bg-transparent text-zinc-900 dark:text-white transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Logo & Name: PromptZ */}
        <button
          type="button"
          onClick={onScrollToBuilder}
          className="group cursor-pointer focus:outline-hidden transition-transform duration-150 active:scale-95"
          title="PromptZ"
        >
          <Logo size="sm" lang={lang} />
        </button>

        {/* Right Controls: Settings, History, Language, Theme Appearance */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Settings Icon: view and edit system instruction */}
          <button
            type="button"
            onClick={onOpenSettings}
            className={iconButtonClassName}
            title={t.settings}
            aria-label={t.settings}
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* History Icon */}
          <button
            type="button"
            onClick={onOpenLibrary}
            className={iconButtonClassName}
            title={t.library || 'History'}
            aria-label={t.library || 'History'}
          >
            <History className="w-4 h-4" />
            {savedCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-3.5 px-1 rounded-full text-[9px] font-mono font-bold bg-[#7C3AED] text-white flex items-center justify-center shadow-xs">
                {savedCount}
              </span>
            )}
          </button>

          {/* Language Toggle */}
          <button
            type="button"
            onClick={onToggleLang}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-all duration-150 cursor-pointer text-xs font-bold font-mono focus:outline-hidden"
            title={isAr ? 'Switch to English' : 'التحويل للعربية'}
            aria-label="Language"
          >
            <Languages className="w-3.5 h-3.5" />
            <span className="uppercase text-[11px]">{isAr ? 'AR' : 'EN'}</span>
          </button>

          {/* Theme Toggle (Light / Dark) */}
          <button
            type="button"
            onClick={onToggleTheme}
            className={iconButtonClassName}
            title={theme === 'dark' ? t.themeLight || 'Light Mode' : t.themeDark || 'Dark Mode'}
            aria-label="Appearance"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
