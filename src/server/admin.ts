/**
 * The admin dashboard's data (/admin in the site), for signed-in admins: the emails in
 * ADMIN_EMAILS plus the ones added in the dashboard's settings.
 *
 *   GET  /api/admin/stats?days=1|7|30|90  everything the dashboard's pages show, as JSON
 *   GET  /api/admin/user?email=           one account: its activity and domains
 *   POST /api/admin/delete-user { email } removes an account: the user, its counts and its history
 *   GET  /api/admin/settings              the settings, the admins and the change log
 *   POST /api/admin/settings { ... }      saves changed settings (src/server/settings.ts)
 *   POST /api/admin/campaigns { action: 'save' | 'delete', slug, name?, platform? }
 *   GET  /api/admin/balance               the OpenRouter credit left
 *   GET  /api/admin/models                whether OpenRouter serves each model right now
 *   POST /api/admin/test-report           emails the periodic report now, to try it
 *
 * Every Generate and Enhance call is also logged to the D1 table `events` (recordEvent), with what
 * was asked for (domain, depth, language), how it ended and how long it took, what it cost, the
 * country (from Cloudflare) and the kind of device. The text the user wrote is never stored there.
 */
import { OPENROUTER_MODELS } from '../constants.js';
import { accountKey, adminEmails, allAdminEmails, ensureSchema, type AccountEnv, type D1Database, type SessionUser } from './account.js';
import { ensureTable as ensureHistoryTable } from './history.js';
import { ensureTable as ensureFeedbackTable } from './feedback.js';
import { audit, ensureSettingsTables, readSettings, SETTING_BOUNDS, writeSettings } from './settings.js';
import { deleteCampaign, deviceOf, ensureVisitTables, saveCampaign, visitorKey } from './visits.js';
import { sendReport } from './alerts.js';
import type { CallMeta } from './api.js';

export type EventKind = 'generate' | 'refine';
/** ok · clarify (asked questions first) · error (the model failed) · invalid (bad input) · limit (daily limit) · busy (DB down) */
export type EventOutcome = 'ok' | 'clarify' | 'error' | 'invalid' | 'limit' | 'busy';

export interface EventInfo {
  kind: EventKind;
  outcome: EventOutcome;
  domain?: unknown;
  depth?: unknown;
  language?: unknown;
  model?: unknown;
  ms?: number;
  ownKey?: boolean;
  meta?: CallMeta;
}

/** The account settings plus the OpenRouter key, for the balance and the model checks. */
export interface AdminEnv extends AccountEnv {
  OPENROUTER_API_KEY?: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
const fail = (status: number, message: string) => json(status, { error: { code: status, message } });

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const short = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

let eventsReady = false;

export async function ensureEvents(db: D1Database): Promise<void> {
  if (eventsReady) return;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS events (
         id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL,
         account TEXT, visitor TEXT, domain TEXT, depth TEXT, language TEXT, outcome TEXT NOT NULL,
         model TEXT, ms INTEGER, country TEXT, device TEXT, own_key INTEGER NOT NULL DEFAULT 0,
         cost REAL, error TEXT, detail TEXT)`
    )
    .bind()
    .run();
  // Tables made before cost and errors were logged get the columns; on newer ones this fails harmlessly.
  for (const column of ['cost REAL', 'error TEXT', 'detail TEXT']) {
    await db
      .prepare(`ALTER TABLE events ADD COLUMN ${column}`)
      .bind()
      .run()
      .catch(() => {});
  }
  await db.prepare('CREATE INDEX IF NOT EXISTS events_day ON events (day)').bind().run();
  eventsReady = true;
}

/** Logs one model call for the dashboard. Never throws: a logging failure must not fail the call. */
export async function recordEvent(request: Request, env: AccountEnv, user: SessionUser | null, info: EventInfo): Promise<void> {
  if (!env.DB) return;
  try {
    await ensureEvents(env.DB);
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO events (ts, day, kind, account, visitor, domain, depth, language, outcome, model, ms, country, device, own_key, cost, error, detail)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`
    )
      .bind(
        now,
        now.slice(0, 10),
        info.kind,
        user ? accountKey(user) : null,
        await visitorKey(request, env),
        short(info.domain, 40),
        short(info.depth, 20),
        short(info.language, 10),
        info.outcome,
        short(info.model, 80),
        typeof info.ms === 'number' ? Math.round(info.ms) : null,
        short((request as any).cf?.country, 4),
        deviceOf(request),
        info.ownKey ? 1 : 0,
        info.meta?.cost || null,
        info.meta?.error || null,
        short(info.meta?.detail, 300)
      )
      .run();
  } catch (err) {
    console.warn('[Admin] Could not record the event:', err);
  }
}

export async function isAdminUser(env: AccountEnv, user: SessionUser | null): Promise<boolean> {
  return Boolean(user && (await allAdminEmails(env)).includes(user.email.toLowerCase()));
}

export async function handleAdmin(request: Request, env: AdminEnv, user: SessionUser | null, pathname: string): Promise<Response> {
  if (!user || !(await isAdminUser(env, user))) {
    const reason = !user ? 'signed_out' : (await allAdminEmails(env)).length ? 'not_admin' : 'no_admins';
    return json(403, { error: { code: 403, reason, email: user?.email || null } });
  }
  if (!env.DB) return fail(503, 'The database is not configured.');
  const db = env.DB;
  await ensureSchema(db);
  await ensureEvents(db);
  await ensureHistoryTable(db);
  await ensureFeedbackTable(db);
  await ensureSettingsTables(db);
  await ensureVisitTables(db);
  const url = new URL(request.url);
  const get = request.method === 'GET';
  const body: any = get ? {} : await request.json().catch(() => ({}));

  switch (pathname) {
    case '/api/admin/stats': {
      if (!get) return fail(405, 'Use GET.');
      const asked = Number(url.searchParams.get('days'));
      return json(200, await stats(db, [1, 7, 30, 90].includes(asked) ? asked : 30, user.email));
    }
    case '/api/admin/user': {
      if (!get) return fail(405, 'Use GET.');
      return json(200, await userDetail(db, String(url.searchParams.get('email') || '').toLowerCase()));
    }
    case '/api/admin/delete-user': {
      if (get) return fail(405, 'Use POST.');
      const email = String(body?.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) return fail(400, 'email is required.');
      if ((await allAdminEmails(env)).includes(email)) return fail(400, 'An admin account cannot be deleted here.');
      await deleteAccount(db, email);
      await audit(db, user.email, 'user.delete', { email });
      return json(200, { ok: true });
    }
    case '/api/admin/settings': {
      if (!get) {
        const extra = body?.extraAdmins;
        const me = user.email.toLowerCase();
        // Removing yourself would lock you out; ADMIN_EMAILS stays the way back in.
        if (Array.isArray(extra) && !adminEmails(env).includes(me) && !extra.map((e) => String(e).toLowerCase()).includes(me)) {
          return fail(400, 'You cannot remove your own admin access.');
        }
        await writeSettings(db, body, user.email);
      }
      return json(200, await settingsView(db, env));
    }
    case '/api/admin/campaigns': {
      if (get) return fail(405, 'Use POST.');
      if (body?.action === 'delete') {
        await deleteCampaign(db, String(body?.slug || ''));
        await audit(db, user.email, 'campaign.delete', { slug: body?.slug });
        return json(200, { ok: true });
      }
      const error = await saveCampaign(db, body);
      if (error) return fail(400, error);
      await audit(db, user.email, 'campaign.save', { slug: body?.slug, name: body?.name, platform: body?.platform });
      return json(200, { ok: true });
    }
    case '/api/admin/balance':
      return json(200, (await openRouterBalance(env.OPENROUTER_API_KEY)) || { unavailable: true });
    case '/api/admin/models':
      return json(200, { models: await modelStatus(env.OPENROUTER_API_KEY, (await readSettings(db)).models) });
    case '/api/admin/test-report': {
      if (get) return fail(405, 'Use POST.');
      const sent = await sendReport(env, 'test');
      return sent.ok ? json(200, sent) : fail(502, sent.message);
    }
    default:
      return fail(404, 'Not found.');
  }
}

/** What the privacy policy promises on request: the account, its daily counts and its saved history. */
async function deleteAccount(db: D1Database, email: string): Promise<void> {
  await db.prepare('DELETE FROM users WHERE lower(email) = ?1').bind(email).run();
  await db.prepare("DELETE FROM usage WHERE subject IN ('user:' || ?1, 'refund:user:' || ?1)").bind(email).run();
  await db.prepare('DELETE FROM prompts WHERE owner = ?1').bind(email).run();
  // Ratings and the activity log stay for the totals, without the address.
  await db.prepare('UPDATE feedback SET account = NULL WHERE account = ?1').bind(email).run();
  await db.prepare('UPDATE events SET account = NULL WHERE account = ?1').bind(email).run();
}

type Row = Record<string, any>;

export async function all(db: D1Database, sql: string, ...values: unknown[]): Promise<Row[]> {
  return (await db.prepare(sql).bind(...values).all<Row>()).results || [];
}

export async function first(db: D1Database, sql: string, ...values: unknown[]): Promise<Row> {
  return (await db.prepare(sql).bind(...values).first<Row>()) || {};
}

const pct = (values: number[], p: number) => (values.length ? values[Math.min(values.length - 1, Math.floor((p / 100) * values.length))] : null);

/** A prompt made: a finished Generate call. */
export const MADE = "kind = 'generate' AND outcome = 'ok'";
/** A call that failed: the model did not deliver, or the request was too long. */
export const FAILED = "(outcome = 'error' OR error = 'long')";
/** Every call that counts toward the failure rate. */
export const CALLED = "(outcome IN ('ok', 'clarify', 'error') OR error = 'long')";

export interface Balance {
  total: number;
  used: number;
  remaining: number;
}

let balanceCache: { at: number; value: Balance | null } | null = null;

/** OpenRouter's credit for the site's key, cached for five minutes. */
export async function openRouterBalance(key: string | undefined): Promise<Balance | null> {
  if (!key) return null;
  if (balanceCache && Date.now() - balanceCache.at < 5 * 60_000) return balanceCache.value;
  let value: Balance | null = null;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/credits', { headers: { Authorization: `Bearer ${key}` } });
    const data: any = await res.json().catch(() => null);
    const total = Number(data?.data?.total_credits);
    const used = Number(data?.data?.total_usage);
    if (res.ok && Number.isFinite(total) && Number.isFinite(used)) value = { total, used, remaining: total - used };
  } catch (err) {
    console.warn('[Admin] Could not read the OpenRouter balance:', err);
  }
  balanceCache = { at: Date.now(), value };
  return value;
}

/** Whether OpenRouter serves each model right now (has a provider for it). Uses no credit. */
export async function modelStatus(key: string | undefined, models: string[]): Promise<{ model: string; available: boolean }[]> {
  if (!key) return models.map((model) => ({ model, available: false }));
  return Promise.all(
    models.map(async (model) => {
      try {
        const res = await fetch(`https://openrouter.ai/api/v1/models/${model}/endpoints`, { headers: { Authorization: `Bearer ${key}` } });
        const data: any = await res.json().catch(() => null);
        const endpoints = data?.data?.endpoints;
        return { model, available: res.ok && (!Array.isArray(endpoints) || endpoints.length > 0) };
      } catch {
        return { model, available: false };
      }
    })
  );
}

async function settingsView(db: D1Database, env: AccountEnv) {
  const [settings, log, hits] = await Promise.all([
    readSettings(db),
    all(db, 'SELECT ts, admin, action, detail FROM audit ORDER BY id DESC LIMIT 100'),
    first(
      db,
      `SELECT COUNT(DISTINCT CASE WHEN account IS NULL THEN visitor END) AS anonymous, COUNT(DISTINCT account) AS signedIn
       FROM events WHERE outcome = 'limit' AND day >= ?1`,
      daysAgo(29)
    ),
  ]);
  return {
    settings,
    bounds: SETTING_BOUNDS,
    knownModels: OPENROUTER_MODELS,
    envAdmins: adminEmails(env),
    limitHits: { anonymous: hits.anonymous || 0, signedIn: hits.signedIn || 0 },
    audit: log.map((r) => ({ ...r, detail: r.detail ? JSON.parse(r.detail) : null })),
  };
}

/** Totals for one period: calls, people, cost, visits and new accounts. */
export async function periodTotals(db: D1Database, from: string, to: string) {
  const [events, visits, signups] = await Promise.all([
    first(
      db,
      `SELECT
         SUM(${MADE}) AS prompts,
         SUM(kind = 'refine' AND outcome = 'ok') AS enhanced,
         SUM(kind = 'generate' AND outcome = 'clarify') AS clarify,
         SUM(kind = 'generate' AND outcome IN ('ok', 'clarify')) AS answered,
         SUM(${FAILED}) AS errors,
         SUM(${CALLED}) AS calls,
         SUM(outcome = 'limit') AS limits,
         SUM(${MADE} AND account IS NOT NULL) AS signedInPrompts,
         COUNT(DISTINCT CASE WHEN outcome <> 'limit' THEN COALESCE(account, visitor) END) AS people,
         COUNT(DISTINCT account) AS accounts,
         SUM(CASE WHEN own_key = 0 THEN cost ELSE 0 END) AS cost,
         AVG(CASE WHEN ${MADE} THEN ms END) AS avgMs
       FROM events WHERE day BETWEEN ?1 AND ?2`,
      from,
      to
    ),
    first(db, 'SELECT COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS visits FROM visits WHERE day BETWEEN ?1 AND ?2', from, to),
    first(db, 'SELECT COUNT(*) AS signups FROM (SELECT lower(email) e, MIN(created_at) c FROM users GROUP BY e) WHERE substr(c, 1, 10) BETWEEN ?1 AND ?2', from, to),
  ]);
  const n = (v: unknown) => Number(v) || 0;
  return {
    prompts: n(events.prompts),
    enhanced: n(events.enhanced),
    clarify: n(events.clarify),
    answered: n(events.answered),
    errors: n(events.errors),
    calls: n(events.calls),
    limits: n(events.limits),
    signedInPrompts: n(events.signedInPrompts),
    people: n(events.people),
    accounts: n(events.accounts),
    cost: n(events.cost),
    avgMs: events.avgMs == null ? null : Number(events.avgMs),
    visitors: n(visits.visitors),
    visits: n(visits.visits),
    signups: n(signups.signups),
  };
}

export async function stats(db: D1Database, days: number, viewer: string) {
  const end = today();
  const start = daysAgo(days - 1);
  const prevStart = daysAgo(2 * days - 1);
  const prevEnd = daysAgo(days);
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const { limits } = await readSettings(db);

  const [period, prev, todayRow, usersTotal, since, returning, retention] = await Promise.all([
    periodTotals(db, start, end),
    periodTotals(db, prevStart, prevEnd),
    periodTotals(db, end, end),
    first(db, 'SELECT COUNT(DISTINCT lower(email)) AS n FROM users'),
    first(db, 'SELECT (SELECT MIN(day) FROM events) AS events, (SELECT MIN(day) FROM visits) AS visits'),
    // People who made prompts on more than one day of the period.
    first(
      db,
      `SELECT COUNT(*) AS n FROM (SELECT COALESCE(account, visitor) AS who FROM events WHERE ${MADE} AND day >= ?1 GROUP BY who HAVING COUNT(DISTINCT day) > 1)`,
      start
    ),
    // Accounts that came back on a later day, of the accounts that used the site at all.
    first(
      db,
      `SELECT COUNT(*) AS active, SUM(d > 1) AS returned FROM (
         SELECT COUNT(DISTINCT day) AS d FROM usage WHERE subject LIKE 'user:%' AND count > 0 GROUP BY subject)`
    ),
  ]);

  // Daily rows cover both periods, so the page can draw this period over the previous one.
  const [daily, dailyVisits, signups, hours, last24] = await Promise.all([
    all(
      db,
      `SELECT day,
         SUM(${MADE}) AS prompts,
         SUM(kind = 'refine' AND outcome = 'ok') AS enhanced,
         SUM(${FAILED}) AS errors,
         COUNT(DISTINCT CASE WHEN outcome <> 'limit' THEN COALESCE(account, visitor) END) AS people,
         COUNT(DISTINCT account) AS accounts,
         SUM(CASE WHEN own_key = 0 THEN cost ELSE 0 END) AS cost
       FROM events WHERE day >= ?1 GROUP BY day`,
      prevStart
    ),
    all(
      db,
      `SELECT v.day, COUNT(DISTINCT v.visitor) AS visitors,
         COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.visitor = v.visitor AND e.day = v.day AND ${MADE}) THEN v.visitor END) AS made
       FROM visits v WHERE v.day >= ?1 GROUP BY v.day`,
      start
    ),
    all(
      db,
      'SELECT substr(c, 1, 10) AS day, COUNT(*) AS n FROM (SELECT lower(email) e, MIN(created_at) c FROM users GROUP BY e) WHERE substr(c, 1, 10) >= ?1 GROUP BY day',
      prevStart
    ),
    // UTC hours; the page moves them to the viewer's time zone.
    all(db, `SELECT CAST(substr(ts, 12, 2) AS INTEGER) AS hour, COUNT(*) AS n FROM events WHERE ${MADE} AND day >= ?1 GROUP BY hour`, start),
    // Hours ago (0 = the last hour), for the errors chart.
    all(
      db,
      `SELECT CAST((julianday('now') - julianday(ts)) * 24 AS INTEGER) AS ago, SUM(${FAILED}) AS errors, SUM(${CALLED}) AS calls
       FROM events WHERE ts >= ?1 GROUP BY ago`,
      dayAgo
    ),
  ]);

  const breakdown = (column: string) =>
    all(db, `SELECT COALESCE(${column}, '') AS key, COUNT(*) AS n FROM events WHERE ${MADE} AND day >= ?1 GROUP BY key ORDER BY n DESC LIMIT 16`, start);
  const people = (column: string) =>
    all(
      db,
      `SELECT COALESCE(${column}, '') AS key, COUNT(DISTINCT COALESCE(account, visitor)) AS n FROM events
       WHERE outcome <> 'limit' AND day >= ?1 GROUP BY key ORDER BY n DESC LIMIT 16`,
      start
    );
  const [domains, depths, languages, countries, devices, sources, modelRows, costByDepth] = await Promise.all([
    breakdown('domain'),
    breakdown('depth'),
    breakdown('language'),
    people('country'),
    people('device'),
    all(db, 'SELECT source AS key, COUNT(DISTINCT visitor) AS n FROM visits WHERE day >= ?1 GROUP BY source ORDER BY n DESC', start),
    all(db, `SELECT model, ms, ${FAILED} AS failed FROM events WHERE model IS NOT NULL AND kind = 'generate' AND ${CALLED} AND day >= ?1 ORDER BY id DESC LIMIT 5000`, start),
    all(db, `SELECT depth AS key, AVG(cost) AS avg, COUNT(*) AS n FROM events WHERE ${MADE} AND own_key = 0 AND cost > 0 AND day >= ?1 GROUP BY depth`, start),
  ]);

  // Per model: calls, success rate, median and slowest (95th percentile) time.
  const byModel = new Map<string, { n: number; failed: number; ms: number[] }>();
  for (const r of modelRows) {
    const m = byModel.get(r.model) || { n: 0, failed: 0, ms: [] };
    m.n++;
    if (r.failed) m.failed++;
    else if (typeof r.ms === 'number') m.ms.push(r.ms);
    byModel.set(r.model, m);
  }
  const models = [...byModel].map(([model, m]) => {
    const ms = m.ms.sort((a, b) => a - b);
    return { model, n: m.n, success: (m.n - m.failed) / m.n, median: pct(ms, 50), p95: pct(ms, 95) };
  });

  const [campaigns, errors, errorTypes, feedbackTotals, feedbackByDomain, feedbackRecent, userList, activity] = await Promise.all([
    all(
      db,
      `SELECT c.slug, c.name, c.platform, c.created_at AS created,
         (SELECT COUNT(DISTINCT visitor) FROM visits v WHERE v.campaign = c.slug AND v.day >= ?1) AS visitors,
         (SELECT COUNT(DISTINCT v.visitor) FROM visits v WHERE v.campaign = c.slug AND v.day >= ?1
            AND EXISTS (SELECT 1 FROM events e WHERE e.visitor = v.visitor AND e.day >= v.day AND ${MADE})) AS made
       FROM campaigns c ORDER BY c.created_at DESC`,
      start
    ),
    // Repeats of the same failure for the same person within an hour are one row.
    all(
      db,
      `SELECT MAX(ts) AS ts, kind, error, detail, model, account, country, COUNT(*) AS times FROM events
       WHERE ${FAILED} AND day >= ?1 GROUP BY COALESCE(account, visitor), error, detail, substr(ts, 1, 13)
       ORDER BY ts DESC LIMIT 200`,
      start
    ),
    all(db, `SELECT COALESCE(error, 'other') AS key, COUNT(*) AS n FROM events WHERE ${FAILED} AND ts >= ?1 GROUP BY key ORDER BY n DESC`, dayAgo),
    first(
      db,
      `SELECT SUM(rating = 'up') AS up, SUM(rating = 'down') AS down,
         SUM(rating = 'up' AND substr(created_at, 1, 10) >= ?1) AS upPeriod,
         SUM(rating = 'down' AND substr(created_at, 1, 10) >= ?1) AS downPeriod,
         SUM(rating = 'up' AND substr(created_at, 1, 10) BETWEEN ?2 AND ?3) AS upPrev,
         SUM(rating = 'down' AND substr(created_at, 1, 10) BETWEEN ?2 AND ?3) AS downPrev
       FROM feedback`,
      start,
      prevStart,
      prevEnd
    ),
    all(
      db,
      `SELECT COALESCE(domain, '') AS key, SUM(rating = 'up') AS up, COUNT(*) AS n FROM feedback
       WHERE substr(created_at, 1, 10) >= ?1 GROUP BY key ORDER BY n DESC LIMIT 12`,
      start
    ),
    all(db, 'SELECT id, created_at, account, rating, domain, depth, language, request, prompt, comment FROM feedback ORDER BY id DESC LIMIT 200'),
    all(
      db,
      `WITH u AS (
         SELECT lower(email) AS email, MAX(name) AS name, MIN(created_at) AS created,
                MAX(id NOT LIKE 'email:%') AS google, MAX(id LIKE 'email:%') AS byEmail
         FROM users GROUP BY lower(email)
       ), us AS (
         SELECT substr(subject, 6) AS email, SUM(MIN(count, ?2)) AS total,
                MAX(CASE WHEN count > 0 THEN day END) AS lastDay,
                SUM(CASE WHEN day = ?1 THEN MIN(count, ?2) ELSE 0 END) AS today
         FROM usage WHERE subject LIKE 'user:%' GROUP BY subject
       ), p AS (SELECT owner AS email, COUNT(*) AS saved FROM prompts GROUP BY owner),
       f AS (SELECT account AS email, COUNT(*) AS ratings FROM feedback WHERE account IS NOT NULL GROUP BY account),
       e AS (SELECT account AS email, MAX(ts) AS lastSeen FROM events WHERE account IS NOT NULL GROUP BY account),
       d AS (
         SELECT account AS email, domain, COUNT(*) AS n,
                ROW_NUMBER() OVER (PARTITION BY account ORDER BY COUNT(*) DESC) AS r
         FROM events WHERE account IS NOT NULL AND ${MADE} GROUP BY account, domain
       )
       SELECT u.email, u.name, u.created, u.google, u.byEmail,
              COALESCE(us.total, 0) AS total, us.lastDay, COALESCE(us.today, 0) AS today, e.lastSeen,
              COALESCE(p.saved, 0) AS saved, COALESCE(f.ratings, 0) AS ratings, d.domain AS topDomain
       FROM u LEFT JOIN us ON us.email = u.email LEFT JOIN p ON p.email = u.email
              LEFT JOIN f ON f.email = u.email LEFT JOIN e ON e.email = u.email
              LEFT JOIN d ON d.email = u.email AND d.r = 1
       ORDER BY u.created DESC LIMIT 5000`,
      end,
      limits.signedIn
    ),
    // Model calls, sign-ups and ratings, newest first.
    all(
      db,
      `SELECT * FROM (
         SELECT ts, kind, account, domain, depth, outcome, country, device, NULL AS rating FROM events ORDER BY id DESC LIMIT 100
       ) UNION ALL SELECT * FROM (
         SELECT MIN(created_at), 'signup', lower(email), CASE WHEN MIN(id) LIKE 'email:%' THEN 'email' ELSE 'google' END, NULL, NULL, NULL, NULL, NULL
         FROM users GROUP BY lower(email) ORDER BY MIN(created_at) DESC LIMIT 30
       ) UNION ALL SELECT * FROM (
         SELECT created_at, 'feedback', account, domain, depth, NULL, NULL, NULL, rating FROM feedback ORDER BY id DESC LIMIT 30
       ) ORDER BY 1 DESC LIMIT 100`
    ),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    viewer,
    range: { days, start, end, prevStart, prevEnd },
    trackingSince: { events: since.events || null, visits: since.visits || null },
    limits,
    users: {
      total: usersTotal.n || 0,
      activeToday: todayRow.accounts,
      retention: { active: retention.active || 0, returned: retention.returned || 0 },
    },
    period: { ...period, returning: returning.n || 0 },
    prev,
    today: todayRow,
    daily,
    dailyVisits,
    signups,
    hours,
    last24,
    models,
    costByDepth,
    breakdowns: { domains, depths, languages, countries, devices, sources },
    campaigns,
    errors,
    errorTypes,
    feedback: { totals: feedbackTotals, byDomain: feedbackByDomain, recent: feedbackRecent },
    userList,
    activity,
  };
}

async function userDetail(db: D1Database, email: string) {
  const [daily, domains, totals] = await Promise.all([
    all(db, "SELECT day, count AS n FROM usage WHERE subject = 'user:' || ?1 AND day >= ?2 ORDER BY day", email, daysAgo(29)),
    all(db, `SELECT COALESCE(domain, '') AS key, COUNT(*) AS n FROM events WHERE account = ?1 AND ${MADE} GROUP BY key ORDER BY n DESC LIMIT 8`, email),
    first(
      db,
      `SELECT SUM(${MADE}) AS prompts, SUM(kind = 'refine' AND outcome = 'ok') AS enhanced, SUM(${FAILED}) AS errors, MIN(ts) AS firstSeen
       FROM events WHERE account = ?1`,
      email
    ),
  ]);
  return { email, daily, domains, totals };
}
