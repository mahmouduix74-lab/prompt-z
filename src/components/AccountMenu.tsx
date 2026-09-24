import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, History, Hourglass, LogIn, LogOut, Mail, X, CheckCircle2, Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import { AppLang } from '../utils/i18n';
import { AccountState, AccountUsage, requestEmailLink } from '../services/account';
import { PromptZIcon } from './Logo';

/** Soft ease-out used for menus and dialogs. */
const EASE = [0.22, 1, 0.36, 1] as const;

/** Same height as the language and theme controls next to it (32px). */
const signInButtonClassName =
  'inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl text-sm font-semibold leading-none text-white bg-purple-600 hover:bg-purple-700 shadow-sm shadow-purple-600/20 transition-colors duration-150 whitespace-nowrap cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950';

const menuItemClassName =
  'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm text-start text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 focus:outline-hidden focus-visible:bg-zinc-100 dark:focus-visible:bg-zinc-800/70 cursor-pointer';

function Avatar({ name, picture, size = 'sm' }: { name: string; picture?: string; size?: 'sm' | 'md' }) {
  const [broken, setBroken] = useState(false);
  const box = size === 'md' ? 'w-10 h-10 text-base' : 'w-7 h-7 text-xs';
  if (picture && !broken) {
    return (
      <img
        src={picture}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`${box} rounded-full object-cover shrink-0 ring-1 ring-black/5 dark:ring-white/10`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} rounded-full shrink-0 inline-flex items-center justify-center font-bold text-white bg-gradient-to-br from-purple-500 to-violet-600`}
    >
      {(name.trim()[0] || '?').toUpperCase()}
    </span>
  );
}

/** Today's free prompts: what is left of the daily allowance, as a number and a bar. */
function UsageMeter({ usage, lang }: { usage: AccountUsage; lang: AppLang }) {
  const isAr = lang === 'ar';
  const share = usage.limit ? usage.remaining / usage.limit : 0;
  const tone = usage.remaining === 0 ? 'bg-rose-500' : share <= 0.34 ? 'bg-amber-500' : 'bg-purple-600';
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold text-zinc-800 dark:text-zinc-100">
          <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          {isAr ? 'البرومبتات المجانية اليوم' : "Today's free prompts"}
        </span>
        <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-50" dir="ltr">
          {usage.remaining}/{usage.limit}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={usage.remaining}
        aria-label={isAr ? 'المتبقي من برومبتات اليوم' : "Prompts left today"}
      >
        <div className={`h-full rounded-full ${tone} transition-[width] duration-500`} style={{ width: `${share * 100}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        {usage.remaining === 0
          ? isAr
            ? 'انتهت برومبتات اليوم، وتتجدد غدًا.'
            : 'All used today. They renew tomorrow.'
          : isAr
            ? `متبقٍ ${usage.remaining} من ${usage.limit}، وتتجدد كل يوم.`
            : `${usage.remaining} of ${usage.limit} left. They renew every day.`}
      </p>
    </div>
  );
}

interface AccountMenuProps {
  account: AccountState | null;
  lang: AppLang;
  onSignIn: () => void;
  onOpenLibrary: () => void;
}

/** Header control: "Sign in" (opens SignInDialog), or the user's avatar, name and a menu. */
export const AccountMenu: React.FC<AccountMenuProps> = ({ account, lang, onSignIn, onOpenLibrary }) => {
  const isAr = lang === 'ar';
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!account || !account.authEnabled) return null;
  const { user } = account;

  if (!user) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        aria-label={isAr ? 'تسجيل الدخول' : 'Sign in'}
        className={`${signInButtonClassName} ${isAr ? 'font-arabic' : ''}`}
      >
        <LogIn className="w-4 h-4" />
        <span className="hidden min-[360px]:inline">{isAr ? 'تسجيل الدخول' : 'Sign in'}</span>
      </button>
    );
  }

  const displayName = user.name || user.email.split('@')[0];
  const firstName = displayName.split(' ')[0];

  return (
    <div ref={rootRef} className={`relative ${isAr ? 'font-arabic' : ''}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={isAr ? `حساب ${displayName}` : `${displayName}'s account`}
        className="inline-flex items-center gap-2 h-9 ps-1 pe-2.5 rounded-xl text-sm font-semibold leading-none text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors duration-150 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400"
      >
        <Avatar name={displayName} picture={user.picture} />
        <span className="hidden sm:inline max-w-[8rem] truncate">{firstName}</span>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE }}
            className="absolute top-full mt-2 end-0 z-50 w-72 max-w-[calc(100vw-2rem)] p-1.5 rounded-2xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-black/10 origin-top"
          >
            <div className="flex items-center gap-3 px-3 py-3">
              <Avatar name={displayName} picture={user.picture} size="md" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{displayName}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate" dir="ltr">
                  {user.email}
                </p>
              </div>
            </div>
            <div className="h-px bg-zinc-200 dark:bg-zinc-800 mx-2 my-1" />
            {account.usage && (
              <>
                <UsageMeter usage={account.usage} lang={lang} />
                <div className="h-px bg-zinc-200 dark:bg-zinc-800 mx-2 my-1" />
              </>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenLibrary();
              }}
              className={menuItemClassName}
            >
              <History className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              {isAr ? 'السجل' : 'History'}
            </button>
            <a role="menuitem" href="/api/auth/logout" className={menuItemClassName}>
              <LogOut className="w-4 h-4 text-zinc-500" />
              {isAr ? 'تسجيل الخروج' : 'Sign out'}
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24z" />
    <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
    <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z" />
  </svg>
);

interface SignInDialogProps {
  open: boolean;
  lang: AppLang;
  account: AccountState | null;
  onClose: () => void;
}

/** Sign-in choice: continue with Google, or get a one-time link by email. */
export const SignInDialog: React.FC<SignInDialogProps> = ({ open, lang, account, onClose }) => {
  const isAr = lang === 'ar';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus('idle');
    setError(null);
    const focusTimer = window.setTimeout(() => firstFieldRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const errors: Record<string, string> = isAr
    ? {
        invalid_email: 'اكتب بريدًا إلكترونيًا صحيحًا.',
        too_many_emails: 'أُرسلت رسائل كثيرة لهذا البريد اليوم. حاول غدًا أو استخدم جوجل.',
        default: 'تعذر إرسال الرسالة. حاول مرة أخرى.',
      }
    : {
        invalid_email: 'Enter a valid email address.',
        too_many_emails: 'Too many emails to this address today. Try tomorrow or use Google.',
        default: 'Could not send the email. Please try again.',
      };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus('sending');
    const reason = await requestEmailLink(email.trim(), lang);
    if (reason) {
      setError(errors[reason] || errors.default);
      setStatus('idle');
    } else {
      setStatus('sent');
    }
  };

  return (
    <AnimatePresence>
      {open && account && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="signin-title"
            dir={isAr ? 'rtl' : 'ltr'}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.28, ease: EASE }}
            className={`relative w-full max-w-[400px] rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xl shadow-purple-950/20 p-7 sm:p-8 text-zinc-900 dark:text-zinc-100 ${isAr ? 'font-arabic' : ''}`}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={isAr ? 'إغلاق' : 'Close'}
              className="absolute top-4 end-4 p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center mb-7">
              <PromptZIcon sizeClass="w-12 h-12" />
              <h2 id="signin-title" className="mt-4 text-xl font-bold">
                {isAr ? 'تسجيل الدخول إلى PromptZ' : 'Sign in to PromptZ'}
              </h2>
              <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                {isAr ? 'سجّل الدخول لتحصل على برومبتات إضافية كل يوم.' : 'Sign in to get more prompts every day.'}
              </p>
              {account?.usage && (
                <p className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  {isAr
                    ? `متبقٍ لك ${account.usage.remaining} من ${account.usage.limit} مجانًا اليوم`
                    : `${account.usage.remaining} of ${account.usage.limit} free prompts left today`}
                </p>
              )}
            </div>

            {status === 'sent' ? (
              <div role="status" className="flex flex-col items-center text-center gap-2 py-2">
                <span className="w-12 h-12 rounded-full bg-purple-500/10 inline-flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </span>
                <p className="mt-2 font-semibold">{isAr ? 'راجع بريدك الإلكتروني' : 'Check your email'}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {isAr ? 'أرسلنا رابط الدخول إلى' : 'We sent a sign-in link to'}{' '}
                  <span dir="ltr" className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {email.trim()}
                  </span>
                  {isAr ? '. الرابط صالح 15 دقيقة ولمرة واحدة.' : '. It works once, for 15 minutes.'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {isAr
                    ? 'افتح الرابط في هذا المتصفح نفسه ليتم تسجيل دخولك هنا.'
                    : 'Open the link in this same browser, or you will be signed in somewhere else.'}
                </p>
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="mt-3 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                >
                  {isAr ? 'استخدام بريد آخر' : 'Use a different email'}
                </button>
              </div>
            ) : (
              <>
                {account.google && (
                  <a
                    ref={(el) => {
                      firstFieldRef.current = el;
                    }}
                    href="/api/auth/login"
                    className="flex items-center justify-center gap-3 w-full h-12 px-4 rounded-2xl text-sm font-semibold border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400"
                  >
                    <GoogleIcon />
                    {isAr ? 'المتابعة باستخدام Google' : 'Continue with Google'}
                  </a>
                )}

                {account.google && account.email && (
                  <div className="flex items-center gap-3 my-5 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                    {isAr ? 'أو بالبريد الإلكتروني' : 'or with email'}
                    <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                )}

                {account.email && (
                  <form onSubmit={submit} className="flex flex-col gap-2.5" noValidate>
                    <label htmlFor="signin-email" className="sr-only">
                      {isAr ? 'البريد الإلكتروني' : 'Email'}
                    </label>
                    <input
                      ref={(el) => {
                        if (!account.google) firstFieldRef.current = el;
                      }}
                      id="signin-email"
                      type="email"
                      dir="ltr"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? 'signin-error' : undefined}
                      className={`w-full h-12 px-4 rounded-2xl text-sm border bg-white dark:bg-zinc-950 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/60 focus:border-purple-500 ${
                        error ? 'border-rose-400' : 'border-zinc-300 dark:border-zinc-700'
                      }`}
                    />
                    {error && (
                      <p id="signin-error" className="text-sm text-rose-600 dark:text-rose-400">
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={status === 'sending' || !email.trim()}
                      className="flex items-center justify-center gap-2 w-full h-12 px-4 rounded-2xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
                    >
                      <Mail className="w-4 h-4" />
                      {status === 'sending'
                        ? isAr
                          ? 'جاري الإرسال...'
                          : 'Sending...'
                        : isAr
                          ? 'أرسل رابط الدخول'
                          : 'Email me a sign-in link'}
                    </button>
                  </form>
                )}

                <p className="mt-6 text-xs text-center text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {isAr ? 'بتسجيل الدخول أنت توافق على ' : 'By signing in you agree to the '}
                  <a href="/terms" className="underline hover:text-purple-600 dark:hover:text-purple-400">
                    {isAr ? 'الشروط' : 'Terms'}
                  </a>
                  {isAr ? ' و' : ' and '}
                  <a href="/privacy" className="underline hover:text-purple-600 dark:hover:text-purple-400">
                    {isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}
                  </a>
                  .
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface LimitDialogProps {
  open: boolean;
  lang: AppLang;
  canSignIn: boolean;
  limit?: number;
  onSignIn: () => void;
  onClose: () => void;
}

/** Popup shown when today's prompts are used up: offers sign-in for more, or says when they renew. */
export const LimitDialog: React.FC<LimitDialogProps> = ({ open, lang, canSignIn, limit, onSignIn, onClose }) => {
  const isAr = lang === 'ar';
  const n = limit ?? (canSignIn ? 3 : 6);
  const title = canSignIn
    ? isAr
      ? 'انتهت البرومبتات المجانية لليوم'
      : "You've used today's free prompts"
    : isAr
      ? 'انتهت برومبتات اليوم'
      : "You've used today's prompts";
  const body = canSignIn
    ? isAr
      ? `استخدمت ${n} برومبتات مجانية اليوم. سجّل الدخول لتحصل على 3 برومبتات إضافية الآن.`
      : `You've used ${n} free prompts today. Sign in to get 3 more right now.`
    : isAr
      ? `استخدمت كل برومبتات اليوم (${n}). يتجدد العدد غدًا.`
      : `You've used all ${n} of today's prompts. They renew tomorrow.`;

  return (
    <Modal open={open} lang={lang} labelledBy="limit-title" onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <span className="w-14 h-14 rounded-2xl bg-purple-500/10 inline-flex items-center justify-center">
          <Hourglass className="w-7 h-7 text-purple-600 dark:text-purple-400" />
        </span>
        <h2 id="limit-title" className="mt-4 text-xl font-bold">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{body}</p>
        <div className="mt-6 flex flex-col gap-2 w-full">
          {canSignIn && (
            <button
              type="button"
              data-autofocus
              onClick={() => {
                onClose();
                onSignIn();
              }}
              className="flex items-center justify-center gap-2 w-full h-12 px-4 rounded-2xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 cursor-pointer transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
            >
              <LogIn className="w-4 h-4" />
              {isAr ? 'تسجيل الدخول' : 'Sign in'}
            </button>
          )}
          <button
            type="button"
            data-autofocus={canSignIn ? undefined : true}
            onClick={onClose}
            className={`w-full h-12 px-4 rounded-2xl text-sm font-semibold cursor-pointer transition-colors duration-150 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400 ${
              canSignIn
                ? 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                : 'text-white bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {canSignIn ? (isAr ? 'ليس الآن' : 'Not now') : isAr ? 'حسنًا' : 'OK'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
