import React from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { AppLang } from '../utils/i18n';
import { AccountState } from '../services/account';

interface AccountMenuProps {
  account: AccountState | null;
  lang: AppLang;
}

/** Header controls: prompts left today, and Google sign-in or sign-out. Hidden without the account API. */
export const AccountMenu: React.FC<AccountMenuProps> = ({ account, lang }) => {
  if (!account) return null;
  const isAr = lang === 'ar';
  const { usage, user, authEnabled } = account;
  const firstName = user?.name?.split(' ')[0] || user?.email || '';

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {usage && (
        <span
          className="hidden min-[360px]:inline-flex px-2 sm:px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 whitespace-nowrap"
          title={isAr ? 'البرومبتات المتبقية اليوم' : 'Prompts left today'}
        >
          <span className="sm:hidden">{`${usage.remaining}/${usage.limit}`}</span>
          <span className="hidden sm:inline">
            {isAr ? `${usage.remaining} من ${usage.limit} اليوم` : `${usage.remaining}/${usage.limit} today`}
          </span>
        </span>
      )}

      {authEnabled && !user && (
        <a
          href="/api/auth/login"
          aria-label={isAr ? 'الدخول بجوجل' : 'Sign in with Google'}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors duration-150 whitespace-nowrap"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span className="hidden min-[400px]:inline sm:hidden">{isAr ? 'دخول' : 'Sign in'}</span>
          <span className="hidden sm:inline">{isAr ? 'الدخول بجوجل' : 'Sign in with Google'}</span>
        </a>
      )}

      {user && (
        <a
          href="/api/auth/logout"
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-all duration-150 max-w-[6rem] sm:max-w-[10rem]"
          title={isAr ? `تسجيل الخروج (${user.email})` : `Sign out (${user.email})`}
        >
          <span className="truncate">{firstName}</span>
          <LogOut className="w-3.5 h-3.5 shrink-0" />
        </a>
      )}
    </div>
  );
};

interface LimitNoticeProps {
  lang: AppLang;
  canSignIn: boolean;
  limit?: number;
  onDismiss: () => void;
}

/** Shown when today's prompts are used up: offers sign-in for more, or asks to come back tomorrow. */
export const LimitNotice: React.FC<LimitNoticeProps> = ({ lang, canSignIn, limit, onDismiss }) => {
  const isAr = lang === 'ar';
  const count = limit ? ` (${limit})` : '';
  const message = canSignIn
    ? isAr
      ? `استخدمت البرومبتات المجانية لليوم${count}. سجّل الدخول بجوجل لتحصل على 3 برومبتات إضافية.`
      : `You have used today's free prompts${count}. Sign in with Google to get 3 more.`
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
          <a
            href="/api/auth/login"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors duration-150"
          >
            <LogIn className="w-3.5 h-3.5" />
            {isAr ? 'الدخول بجوجل' : 'Sign in with Google'}
          </a>
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
