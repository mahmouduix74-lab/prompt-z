import React from 'react';
import { motion } from 'motion/react';
import { History, Sun, Moon, Languages, Sparkles } from 'lucide-react';
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
  onSignIn?: () => void;
}

// Every header control is 36px tall, so language, theme and account line up.
const iconButtonClassName =
  'relative inline-flex items-center justify-center w-8 h-full rounded-lg text-zinc-600 dark:text-zinc-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400';

function CreditsBadge({
  usage,
  dailyCredits,
  lang,
  signedIn,
  onSignIn,
}: {
  usage: NonNullable<AccountState['usage']>;
  /** What an account gets a day; the badge always shows this number. */
  dailyCredits: number;
  lang: AppLang;
  signedIn: boolean;
  onSignIn: () => void;
}) {
  const isAr = lang === 'ar';
  const [open, setOpen] = React.useState(false);
  const title = isAr ? `متبقٍ ${usage.remaining} من ${usage.limit} اليوم` : `${usage.remaining} of ${usage.limit} left today`;
  const note = signedIn
    ? isAr
      ? 'تتجدد كل يوم.'
      : 'They renew every day.'
    : isAr
      ? `سجّل الدخول لتحصل على ${dailyCredits} كل يوم.`
      : `Sign in to get ${dailyCredits} every day.`;

  return (
    <div className="relative group" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        // Visitors go to sign-in; for a signed-in user a tap shows the count (hover does on desktop).
        onClick={() => (signedIn ? setOpen((v) => !v) : onSignIn())}
        onBlur={() => setOpen(false)}
        aria-label={`${title}. ${note}`}
        aria-describedby="credits-tooltip"
        className="inline-flex items-center gap-1.5 h-9 px-2 sm:px-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-sm font-medium leading-none text-zinc-900 dark:text-white hover:border-purple-400 dark:hover:border-purple-500 transition-colors duration-150 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400"
      >
        <Sparkles className="hidden sm:block w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
        <span className="tabular-nums">
          {dailyCredits} {isAr ? 'كريدت' : 'credits'}
        </span>
      </button>
      <div
        id="credits-tooltip"
        role="tooltip"
        className={`absolute top-full mt-2 end-0 z-50 w-max max-w-[15rem] px-3 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-800 text-white shadow-lg text-xs leading-relaxed pointer-events-none transition-opacity duration-150 ${
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
        } ${isAr ? 'font-arabic text-right' : 'text-left'}`}
      >
        <p className="font-semibold tabular-nums">{title}</p>
        <p className="text-zinc-300">{note}</p>
      </div>
    </div>
  );
}

export const Header: React.FC<HeaderProps> = ({
  savedCount = 0,
  theme,
  onToggleTheme,
  lang,
  onToggleLang,
  onOpenLibrary,
  onScrollToBuilder,
  account = null,
  onSignIn = () => {},
}) => {
  const t = UI_STRINGS[lang];
  const isAr = lang === 'ar';

  // Once the page scrolls, the bar gets a frosted background and a slimmer height.
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`sticky top-0 z-40 text-zinc-900 dark:text-white border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
        scrolled
          ? 'bg-white/75 dark:bg-zinc-950/70 backdrop-blur-xl border-zinc-200/70 dark:border-zinc-800/70 shadow-[0_1px_12px_rgba(24,22,34,0.06)]'
          : 'bg-transparent border-transparent'
      }`}
    >
      <div
        className={`max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between gap-2 sm:gap-4 transition-[padding] duration-300 ${
          scrolled ? 'py-2.5' : 'pt-6 pb-2.5 sm:pt-7 sm:pb-3'
        }`}
      >
        {/* Logo & Name: PromptZ */}
        <motion.button
          type="button"
          onClick={onScrollToBuilder}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          className="group cursor-pointer focus:outline-hidden transition-transform duration-150"
          title="PromptZ"
        >
          <Logo
            size="sm"
            lang={lang}
            wordmarkClassName="hidden min-[360px]:flex"
            className={`origin-left rtl:origin-right transition-transform duration-300 ${scrolled ? 'scale-90' : ''}`}
          />
        </motion.button>

        {/* Right Controls: Language, Theme Appearance */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Today's free prompts left, in a small outlined frame next to the language toggle */}
          {account?.usage && (
            <CreditsBadge
              usage={account.usage}
              dailyCredits={account.limits.signedIn}
              lang={lang}
              signedIn={Boolean(account.user)}
              onSignIn={onSignIn}
            />
          )}

          {/* Language and theme share one segmented frame */}
          <div className="inline-flex items-center h-9 p-0.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60">
          <motion.button
            type="button"
            onClick={onToggleLang}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-1.5 h-full px-2 sm:px-2.5 rounded-lg text-zinc-700 dark:text-zinc-200 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-150 cursor-pointer text-sm font-bold focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400"
            title={isAr ? 'Switch to English' : 'التحويل للعربية'}
            aria-label="Language"
          >
            <Languages className="hidden sm:block w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className={isAr ? 'font-arabic font-bold text-sm leading-none' : 'font-mono uppercase text-sm font-bold leading-none'}>
              {isAr ? 'ع' : 'EN'}
            </span>
          </motion.button>

          <span aria-hidden="true" className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />

          {/* Theme Toggle (Light / Dark) */}
          <motion.button
            type="button"
            onClick={onToggleTheme}
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

          {/* Sign in / signed-in user, last */}
          <AccountMenu account={account} lang={lang} onSignIn={onSignIn} onOpenLibrary={onOpenLibrary} />
        </div>
      </div>
    </motion.header>
  );
};
