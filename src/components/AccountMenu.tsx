import React, { useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, Mail, X, CheckCircle2 } from 'lucide-react';
import { AppLang } from '../utils/i18n';
import { AccountState, requestEmailLink } from '../services/account';

const signInButtonClassName =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold leading-none text-white bg-purple-600 hover:bg-purple-700 transition-colors duration-150 whitespace-nowrap cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400';

interface AccountMenuProps {
  account: AccountState | null;
  lang: AppLang;
  onSignIn: () => void;
}

/** Header control: "Sign in" (opens SignInDialog), or the signed-in name with sign-out. */
export const AccountMenu: React.FC<AccountMenuProps> = ({ account, lang, onSignIn }) => {
  if (!account || !account.authEnabled) return null;
  const isAr = lang === 'ar';
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
        <span className="hidden min-[360px]:inline sm:hidden">{isAr ? 'دخول' : 'Sign in'}</span>
        <span className="hidden sm:inline">{isAr ? 'تسجيل الدخول' : 'Sign in'}</span>
      </button>
    );
  }

  const label = user.name?.split(' ')[0] || user.email.split('@')[0];
  return (
    <a
      href="/api/auth/logout"
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-semibold leading-none text-zinc-700 dark:text-zinc-200 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-all duration-150 max-w-[7rem] sm:max-w-[11rem] ${isAr ? 'font-arabic' : ''}`}
      title={isAr ? `تسجيل الخروج (${user.email})` : `Sign out (${user.email})`}
    >
      <span className="truncate">{label}</span>
      <LogOut className="w-4 h-4 shrink-0" />
    </a>
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
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !account) return null;

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        dir={isAr ? 'rtl' : 'ltr'}
        className={`relative w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 text-zinc-900 dark:text-zinc-100 ${isAr ? 'font-arabic' : ''}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={isAr ? 'إغلاق' : 'Close'}
          className="absolute top-3 end-3 p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 id="signin-title" className="text-lg font-bold mb-1">
          {isAr ? 'تسجيل الدخول' : 'Sign in'}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-5">
          {isAr ? 'سجّل الدخول لتحصل على برومبتات إضافية كل يوم.' : 'Sign in to get more prompts every day.'}
        </p>

        {status === 'sent' ? (
          <div role="status" className="flex flex-col items-center text-center gap-2 py-4">
            <CheckCircle2 className="w-10 h-10 text-purple-600" />
            <p className="font-semibold">{isAr ? 'راجع بريدك الإلكتروني' : 'Check your email'}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {isAr
                ? `أرسلنا رابط الدخول إلى ${email.trim()}. الرابط صالح 15 دقيقة ولمرة واحدة.`
                : `We sent a sign-in link to ${email.trim()}. It works once, for 15 minutes.`}
            </p>
          </div>
        ) : (
          <>
            {account.google && (
              <a
                ref={(el) => {
                  firstFieldRef.current = el;
                }}
                href="/api/auth/login"
                className="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors duration-150"
              >
                <GoogleIcon />
                {isAr ? 'المتابعة باستخدام Google' : 'Continue with Google'}
              </a>
            )}

            {account.google && account.email && (
              <div className="flex items-center gap-3 my-4 text-xs text-zinc-500">
                <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                {isAr ? 'أو' : 'or'}
                <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
              </div>
            )}

            {account.email && (
              <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
                <label htmlFor="signin-email" className="text-sm font-semibold">
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
                  className="w-full px-4 py-3 rounded-xl text-sm border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
                {error && (
                  <p id="signin-error" className="text-sm text-rose-600 dark:text-rose-400">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={status === 'sending' || !email.trim()}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
          </>
        )}
      </div>
    </div>
  );
};

interface LimitNoticeProps {
  lang: AppLang;
  canSignIn: boolean;
  limit?: number;
  onSignIn: () => void;
  onDismiss: () => void;
}

/** Shown when today's prompts are used up: offers sign-in for more, or asks to come back tomorrow. */
export const LimitNotice: React.FC<LimitNoticeProps> = ({ lang, canSignIn, limit, onSignIn, onDismiss }) => {
  const isAr = lang === 'ar';
  const count = limit ? ` (${limit})` : '';
  const message = canSignIn
    ? isAr
      ? `استخدمت البرومبتات المجانية لليوم${count}. سجّل الدخول لتحصل على 3 برومبتات إضافية.`
      : `You have used today's free prompts${count}. Sign in to get 3 more.`
    : isAr
      ? `استخدمت كل برومبتات اليوم${count}. يتجدد العدد غدًا.`
      : `You have used all of today's prompts${count}. They renew tomorrow.`;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-purple-500/10 backdrop-blur-md border border-purple-500/25 text-sm text-purple-800 dark:text-purple-200"
    >
      <span>{message}</span>
      <div className="flex items-center gap-2">
        {canSignIn && (
          <button type="button" onClick={onSignIn} className={`${signInButtonClassName} ${isAr ? 'font-arabic' : ''}`}>
            <LogIn className="w-4 h-4" />
            {isAr ? 'تسجيل الدخول' : 'Sign in'}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="px-2.5 py-1.5 rounded-xl text-xs font-bold hover:bg-purple-500/10 transition-colors duration-150 cursor-pointer"
        >
          {isAr ? 'إغلاق' : 'Dismiss'}
        </button>
      </div>
    </div>
  );
};
