/**
 * Settings an admin can change from the dashboard (/admin → Settings), stored in the D1 table
 * `settings` (one JSON value per key) and applied without a new deploy. Each Worker instance keeps
 * them for SETTINGS_TTL_MS, so a change reaches every instance within that time.
 *
 * Every change is written to the `audit` table with who made it and the old and new values.
 */
import { OPENROUTER_MODELS } from '../constants.js';
import type { DepthType } from '../types.js';
import type { D1Database } from './account.js';

export type ReportFrequency = 'off' | 'daily' | 'weekly' | 'monthly';

export interface SiteSettings {
  /** Prompts a day: per IP before signing in, per account after. */
  limits: { anonymous: number; signedIn: number };
  /** Whether Enhance counts toward the daily limit. */
  refineCounts: boolean;
  /** The longest request text accepted, in characters. */
  maxChars: number;
  /** Whether the model may ask clarifying questions before writing the prompt. */
  clarify: boolean;
  /** OPENROUTER_MODELS in the order they are tried. */
  models: string[];
  /** The depth new visitors start with. */
  defaultDepth: DepthType;
  /** Admins added in the dashboard, on top of ADMIN_EMAILS. */
  extraAdmins: string[];
  alerts: {
    modelDown: boolean;
    failRate: boolean;
    lowBalance: boolean;
    spike: boolean;
    report: ReportFrequency;
    /** Where alerts and reports go; empty means the ADMIN_EMAILS addresses. */
    to: string;
  };
}

export const DEFAULT_SETTINGS: SiteSettings = {
  limits: { anonymous: 3, signedIn: 50 },
  refineCounts: true,
  maxChars: 12_000,
  clarify: true,
  models: [...OPENROUTER_MODELS],
  defaultDepth: 'medium',
  extraAdmins: [],
  alerts: { modelDown: true, failRate: true, lowBalance: true, spike: false, report: 'weekly', to: '' },
};

/** The bounds the dashboard enforces, so a typo cannot switch the site off or open it wide. */
export const SETTING_BOUNDS = {
  anonymous: [0, 100],
  signedIn: [1, 1000],
  maxChars: [500, 50_000],
} as const;

const DEPTHS: DepthType[] = ['short', 'medium', 'detailed', 'ultra'];
const REPORTS: ReportFrequency[] = ['off', 'daily', 'weekly', 'monthly'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const SETTINGS_TTL_MS = 30_000;
let cache: { at: number; value: SiteSettings } | null = null;
let ready = false;

export async function ensureSettingsTables(db: D1Database): Promise<void> {
  if (ready) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').bind().run();
  await db
    .prepare('CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, admin TEXT, action TEXT NOT NULL, detail TEXT)')
    .bind()
    .run();
  ready = true;
}

const int = (v: unknown, [min, max]: readonly [number, number], fallback: number) =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

/** Keeps only valid values; anything missing or wrong falls back to `base`. */
export function sanitize(input: any, base: SiteSettings = DEFAULT_SETTINGS): SiteSettings {
  const models = Array.isArray(input?.models) ? input.models.filter((m: unknown) => OPENROUTER_MODELS.includes(m as string)) : [];
  const alerts = input?.alerts || {};
  return {
    limits: {
      anonymous: int(input?.limits?.anonymous, SETTING_BOUNDS.anonymous, base.limits.anonymous),
      signedIn: int(input?.limits?.signedIn, SETTING_BOUNDS.signedIn, base.limits.signedIn),
    },
    refineCounts: bool(input?.refineCounts, base.refineCounts),
    maxChars: int(input?.maxChars, SETTING_BOUNDS.maxChars, base.maxChars),
    clarify: bool(input?.clarify, base.clarify),
    // A reordering of the known models; any model left out is kept at the end.
    models: models.length ? [...new Set([...models, ...OPENROUTER_MODELS])] : base.models,
    defaultDepth: DEPTHS.includes(input?.defaultDepth) ? input.defaultDepth : base.defaultDepth,
    extraAdmins: Array.isArray(input?.extraAdmins)
      ? [...new Set<string>(input.extraAdmins.filter((e: unknown) => typeof e === 'string' && EMAIL.test(e)).map((e: string) => e.toLowerCase()))]
      : base.extraAdmins,
    alerts: {
      modelDown: bool(alerts.modelDown, base.alerts.modelDown),
      failRate: bool(alerts.failRate, base.alerts.failRate),
      lowBalance: bool(alerts.lowBalance, base.alerts.lowBalance),
      spike: bool(alerts.spike, base.alerts.spike),
      report: REPORTS.includes(alerts.report) ? alerts.report : base.alerts.report,
      to: typeof alerts.to === 'string' && (alerts.to === '' || EMAIL.test(alerts.to.trim())) ? alerts.to.trim().toLowerCase() : base.alerts.to,
    },
  };
}

/** The saved settings, or the defaults when there is no database or it cannot be read. */
export async function readSettings(db: D1Database | undefined): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < SETTINGS_TTL_MS) return cache.value;
  let value = DEFAULT_SETTINGS;
  if (db) {
    try {
      await ensureSettingsTables(db);
      const rows = (await db.prepare('SELECT key, value FROM settings').bind().all<{ key: string; value: string }>()).results || [];
      value = sanitize(Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)])));
    } catch (err) {
      console.warn('[Settings] Could not read the settings, using the defaults:', err);
    }
  }
  cache = { at: Date.now(), value };
  return value;
}

/** Saves the changed keys of `patch`, logs each change, and returns the settings now in force. */
export async function writeSettings(db: D1Database, patch: unknown, admin: string): Promise<SiteSettings> {
  await ensureSettingsTables(db);
  cache = null;
  const before = await readSettings(db);
  const after = sanitize({ ...before, ...(patch as object) }, before);
  for (const key of Object.keys(after) as (keyof SiteSettings)[]) {
    const old = JSON.stringify(before[key]);
    const now = JSON.stringify(after[key]);
    if (old === now) continue;
    await db.prepare('INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, now).run();
    await audit(db, admin, `settings.${key}`, { from: before[key], to: after[key] });
  }
  cache = null;
  return readSettings(db);
}

export async function audit(db: D1Database, admin: string | null, action: string, detail?: unknown): Promise<void> {
  await ensureSettingsTables(db);
  await db
    .prepare('INSERT INTO audit (ts, admin, action, detail) VALUES (?1, ?2, ?3, ?4)')
    .bind(new Date().toISOString(), admin, action, detail === undefined ? null : JSON.stringify(detail))
    .run();
}
