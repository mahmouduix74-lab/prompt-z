/**
 * The visitor's sign-in state and today's prompt count, from the Worker's /api/me
 * (src/server/account.ts). Returns null where there is no account API (local Express dev).
 */
export interface AccountUsage {
  used: number;
  limit: number;
  remaining: number;
}

export interface AccountState {
  authEnabled: boolean;
  /** Which ways of signing in are configured. */
  google: boolean;
  email: boolean;
  user: { name: string; email: string } | null;
  usage: AccountUsage | null;
}

export async function fetchAccount(): Promise<AccountState | null> {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      authEnabled: Boolean(data?.authEnabled),
      google: Boolean(data?.google),
      email: Boolean(data?.email),
      user: data?.user ?? null,
      usage: data?.usage ?? null,
    };
  } catch {
    return null;
  }
}

/** Asks for a one-time sign-in link by email. Resolves to an error reason, or null when sent. */
export async function requestEmailLink(email: string, lang: string): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, lang }),
    });
    if (res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.error?.reason || 'email_failed';
  } catch {
    return 'network';
  }
}

/** Thrown by generate/refine when today's limit is used up; the UI explains it instead of falling back. */
export class DailyLimitError extends Error {
  canSignIn: boolean;
  usage: AccountUsage | null;

  constructor(canSignIn: boolean, usage: AccountUsage | null) {
    super('Daily prompt limit reached.');
    this.name = 'DailyLimitError';
    this.canSignIn = canSignIn;
    this.usage = usage;
  }
}

/** The DailyLimitError for a /api response, or null when it is not a daily-limit reply. */
export function dailyLimitError(status: number, data: any): DailyLimitError | null {
  if (status !== 429 || data?.error?.reason !== 'daily_limit') return null;
  return new DailyLimitError(Boolean(data.error.canSignIn), data.usage ?? null);
}
