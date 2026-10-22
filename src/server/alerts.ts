/**
 * Email alerts and the periodic report, sent through Resend (RESEND_API_KEY, EMAIL_FROM) to the
 * address in the dashboard's settings, or to the ADMIN_EMAILS addresses.
 *
 * The Worker's cron trigger (wrangler.jsonc, every 5 minutes) calls runScheduled, which checks:
 *   - modelDown:  no model is served by OpenRouter, or every call in the last 10 minutes failed
 *   - failRate:   more than 10% of the last hour's calls failed (at least 10 calls)
 *   - lowBalance: the OpenRouter credit is down to $1
 *   - spike:      the last hour had twice the usual visitors (at least 20)
 * Each alert is sent at most once an hour. The report goes out at 9:00 Cairo time: every day,
 * on Sundays (weekly) or on the 1st (monthly), as set in the dashboard.
 */
import { DOMAINS } from '../constants.js';
import { allAdminEmails, type D1Database } from './account.js';
import { all, CALLED, ensureEvents, FAILED, first, MADE, modelStatus, openRouterBalance, periodTotals, type AdminEnv } from './admin.js';
import { ensureSettingsTables, readSettings, type SiteSettings } from './settings.js';
import { ensureVisitTables } from './visits.js';

type AlertKind = 'modelDown' | 'failRate' | 'lowBalance' | 'spike';

const LOW_BALANCE = 1;
const FAIL_RATE = 0.1;
const SITE = 'https://prpmtz.online';

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const day = (daysAgo: number) => iso(daysAgo * 86_400_000).slice(0, 10);
const money = (v: number) => `$${v.toFixed(2)}`;

async function recipients(env: AdminEnv, settings: SiteSettings): Promise<string[]> {
  return settings.alerts.to ? [settings.alerts.to] : await allAdminEmails(env);
}

async function sendEmail(env: AdminEnv, to: string[], subject: string, html: string, text: string): Promise<{ ok: boolean; message: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, message: 'RESEND_API_KEY is not set.' };
  if (!to.length) return { ok: false, message: 'No recipient: set one in the dashboard or ADMIN_EMAILS.' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM || 'PromptZ <login@prpmtz.online>', to, subject, html, text }),
  });
  if (res.ok) return { ok: true, message: `Sent to ${to.join(', ')}.` };
  const data: any = await res.json().catch(() => null);
  return { ok: false, message: data?.message || `Resend answered ${res.status}.` };
}

/** A simple right-to-left email: a title, lines of text and a button to the dashboard. */
function emailHtml(title: string, lines: string[], stats?: [string, string, string][]): string {
  const cells = (stats || [])
    .map(
      ([label, value, change]) =>
        `<td style="padding:12px;border:1px solid #e9eaeb;border-radius:12px;background:#fff">
           <div style="font-size:12px;color:#535862">${label}</div>
           <div style="font-size:24px;font-weight:600;color:#181d27">${value}</div>
           <div style="font-size:12px;color:#079455" dir="ltr">${change}</div></td>`
    )
    .join('<td style="width:8px"></td>');
  return `<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;background:#f5f5f5;font-family:Tahoma,Arial,sans-serif">
    <div style="max-width:560px;margin:24px auto;padding:24px;background:#fafafa;border-radius:16px">
      <h1 style="font-size:18px;color:#181d27;margin:0 0 16px">${title}</h1>
      ${cells ? `<table style="width:100%;border-collapse:separate;margin-bottom:16px"><tr>${cells}</tr></table>` : ''}
      ${lines.map((l) => `<p style="font-size:14px;color:#414651;margin:0 0 8px">${l}</p>`).join('')}
      <a href="${SITE}/admin" style="display:inline-block;margin-top:12px;padding:10px 16px;background:#7132f5;color:#fff;border-radius:8px;text-decoration:none;font-size:14px">افتح لوحة التحكم</a>
    </div></body></html>`;
}

const change = (now: number, before: number) => {
  if (!before) return now ? 'جديد' : '—';
  const p = Math.round(((now - before) / before) * 100);
  return `${p >= 0 ? '↑' : '↓'} ${Math.abs(p)}%`;
};

const SOURCE_NAMES: Record<string, string> = {
  instagram: 'انستجرام',
  facebook: 'فيسبوك',
  linkedin: 'لينكدإن',
  x: 'إكس',
  tiktok: 'تيك توك',
  youtube: 'يوتيوب',
  whatsapp: 'واتساب',
  telegram: 'تليجرام',
  google: 'جوجل',
  direct: 'دخول مباشر',
  other: 'مواقع تانية',
};

/** Emails the report for the last day, week or month (a test sends the weekly one). */
export async function sendReport(env: AdminEnv, frequency: 'daily' | 'weekly' | 'monthly' | 'test'): Promise<{ ok: boolean; message: string }> {
  if (!env.DB) return { ok: false, message: 'The database is not configured.' };
  const db = env.DB;
  await ensureEvents(db);
  await ensureVisitTables(db);
  const settings = await readSettings(db);
  const days = frequency === 'daily' ? 1 : frequency === 'monthly' ? 30 : 7;
  // The report covers whole days up to yesterday.
  const [now, before, sources, domains, balance] = await Promise.all([
    periodTotals(db, day(days), day(1)),
    periodTotals(db, day(2 * days), day(days + 1)),
    all(db, 'SELECT source AS key, COUNT(DISTINCT visitor) AS n FROM visits WHERE day BETWEEN ?1 AND ?2 GROUP BY source ORDER BY n DESC LIMIT 1', day(days), day(1)),
    all(db, `SELECT domain AS key, COUNT(*) AS n FROM events WHERE ${MADE} AND day BETWEEN ?1 AND ?2 GROUP BY domain ORDER BY n DESC LIMIT 1`, day(days), day(1)),
    openRouterBalance(env.OPENROUTER_API_KEY),
  ]);
  const name = { daily: 'اليومي', weekly: 'الأسبوعي', monthly: 'الشهري', test: 'الأسبوعي (تجربة)' }[frequency];
  const period = `${day(days)} – ${day(1)}`;
  const success = now.calls ? `${(((now.calls - now.errors) / now.calls) * 100).toFixed(1)}%` : '—';
  const lines = [
    sources[0] && `أكبر مصدر للزوار: ${SOURCE_NAMES[sources[0].key] || sources[0].key} (${Math.round((sources[0].n / Math.max(1, now.visitors)) * 100)}%)`,
    domains[0]?.key && `أكتر مجال: ${DOMAINS.find((d) => d.id === domains[0].key)?.labelAr || domains[0].key}`,
    `نسبة النجاح ${success} · الصرف ${money(now.cost)}${balance ? ` · الرصيد ${money(balance.remaining)}` : ''}`,
  ].filter(Boolean) as string[];
  const title = `تقرير PromptZ ${name} · ${period}`;
  const html = emailHtml(title, lines, [
    ['برومبتات', String(now.prompts), change(now.prompts, before.prompts)],
    ['زوار', String(now.visitors), change(now.visitors, before.visitors)],
    ['حسابات جديدة', String(now.signups), change(now.signups, before.signups)],
  ]);
  const text = [title, `برومبتات: ${now.prompts}`, `زوار: ${now.visitors}`, `حسابات جديدة: ${now.signups}`, ...lines, `${SITE}/admin`].join('\n');
  return sendEmail(env, await recipients(env, settings), title, html, text);
}

/** True (and remembered) when `kind` was not sent within `minutes`. */
async function due(db: D1Database, kind: string, minutes: number): Promise<boolean> {
  const row = await first(db, 'SELECT ts FROM alerts_sent WHERE kind = ?1', kind);
  if (row.ts && Date.now() - Date.parse(row.ts) < minutes * 60_000) return false;
  await db
    .prepare('INSERT INTO alerts_sent (kind, ts) VALUES (?1, ?2) ON CONFLICT(kind) DO UPDATE SET ts = excluded.ts')
    .bind(kind, new Date().toISOString())
    .run();
  return true;
}

async function checkAlerts(env: AdminEnv, db: D1Database, settings: SiteSettings, minute: number): Promise<{ kind: AlertKind; title: string; lines: string[] }[]> {
  const found: { kind: AlertKind; title: string; lines: string[] }[] = [];
  const on = settings.alerts;

  if (on.modelDown) {
    const recent = await first(db, `SELECT SUM(${FAILED}) AS failed, SUM(${CALLED}) AS calls FROM events WHERE ts >= ?1 AND error IS NOT 'long'`, iso(10 * 60_000));
    const status = await modelStatus(env.OPENROUTER_API_KEY, settings.models);
    const noneServed = env.OPENROUTER_API_KEY && status.every((m) => !m.available);
    const allFailing = recent.calls >= 3 && recent.failed === recent.calls;
    if (noneServed || allFailing) {
      found.push({
        kind: 'modelDown',
        title: 'الموديل وقع',
        lines: [noneServed ? 'OpenRouter مش بيقدّم أي موديل من الموديلات دلوقتي.' : `كل الطلبات في آخر 10 دقايق فشلت (${recent.calls} طلب).`],
      });
    }
  }

  if (on.failRate) {
    const hour = await first(db, `SELECT SUM(${FAILED}) AS failed, SUM(${CALLED}) AS calls FROM events WHERE ts >= ?1`, iso(3_600_000));
    if (hour.calls >= 10 && hour.failed / hour.calls > FAIL_RATE) {
      found.push({
        kind: 'failRate',
        title: 'نسبة الفشل عالية',
        lines: [`${hour.failed} من ${hour.calls} طلب فشلوا في آخر ساعة (${Math.round((hour.failed / hour.calls) * 100)}%).`],
      });
    }
  }

  // The balance and the traffic change slowly: checked once an hour.
  if (minute < 5 && on.lowBalance) {
    const balance = await openRouterBalance(env.OPENROUTER_API_KEY);
    if (balance && balance.remaining <= LOW_BALANCE) {
      found.push({ kind: 'lowBalance', title: 'الرصيد قرب يخلص', lines: [`رصيد OpenRouter الباقي ${money(balance.remaining)}.`] });
    }
  }

  if (minute < 5 && on.spike) {
    const [hour, week] = await Promise.all([
      first(db, 'SELECT COUNT(DISTINCT visitor) AS n FROM visits WHERE ts >= ?1', iso(3_600_000)),
      first(db, 'SELECT COUNT(*) AS n FROM visits WHERE ts >= ?1 AND ts < ?2', iso(7 * 86_400_000), iso(3_600_000)),
    ]);
    const usual = (week.n || 0) / (7 * 24 - 1);
    if (hour.n >= 20 && hour.n > 2 * usual) {
      found.push({ kind: 'spike', title: 'زيارات أكتر من العادي', lines: [`${hour.n} زائر في آخر ساعة، والمتوسط حوالي ${Math.round(usual)}.`] });
    }
  }
  return found;
}

/** The cron trigger's work: send due alerts and, at its time, the report. */
export async function runScheduled(env: AdminEnv, now = new Date()): Promise<void> {
  if (!env.DB) return;
  const db = env.DB;
  await ensureEvents(db);
  await ensureVisitTables(db);
  await ensureSettingsTables(db);
  await db.prepare('CREATE TABLE IF NOT EXISTS alerts_sent (kind TEXT PRIMARY KEY, ts TEXT NOT NULL)').bind().run();
  const settings = await readSettings(db);

  for (const alert of await checkAlerts(env, db, settings, now.getUTCMinutes())) {
    if (!(await due(db, alert.kind, 60))) continue;
    const sent = await sendEmail(env, await recipients(env, settings), `PromptZ · ${alert.title}`, emailHtml(alert.title, alert.lines), [alert.title, ...alert.lines].join('\n'));
    if (!sent.ok) console.warn('[Alerts] Could not send:', sent.message);
  }

  const frequency = settings.alerts.report;
  if (frequency === 'off') return;
  const cairo = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', hour: 'numeric', hourCycle: 'h23', weekday: 'short', day: 'numeric' })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const time = Number(cairo.hour) === 9;
  const date = frequency === 'daily' || (frequency === 'weekly' && cairo.weekday === 'Sun') || (frequency === 'monthly' && cairo.day === '1');
  // Sent once in that hour, whichever 5-minute run gets there first.
  if (time && date && (await due(db, 'report', 23 * 60))) {
    const sent = await sendReport(env, frequency);
    if (!sent.ok) console.warn('[Alerts] Could not send the report:', sent.message);
  }
}
