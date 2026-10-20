/**
 * The admin dashboard's data (/admin in the site), for signed-in emails listed in ADMIN_EMAILS.
 *
 *   GET  /api/admin/stats?days=7|30|90   everything the dashboard shows, as JSON
 *   POST /api/admin/delete-user { email } removes an account: the user, its counts and its history
 *
 * Every Generate and Enhance call is also logged to the D1 table `events` (recordEvent), with what
 * was asked for (domain, depth, language), how it ended and how long it took, the country (from
 * Cloudflare) and the kind of device. The text the user wrote is never stored there.
 */
import { accountKey, adminEmails, ensureSchema, ipKey, LIMITS, type AccountEnv, type D1Database, type SessionUser } from './account.js';
import { ensureTable as ensureHistoryTable } from './history.js';
import { ensureTable as ensureFeedbackTable } from './feedback.js';

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
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const short = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

let eventsReady = false;

async function ensureEvents(db: D1Database): Promise<void> {
  if (eventsReady) return;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS events (
         id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL,
         account TEXT, visitor TEXT, domain TEXT, depth TEXT, language TEXT, outcome TEXT NOT NULL,
         model TEXT, ms INTEGER, country TEXT, device TEXT, own_key INTEGER NOT NULL DEFAULT 0)`
    )
    .bind()
    .run();
  await db.prepare('CREATE INDEX IF NOT EXISTS events_day ON events (day)').bind().run();
  eventsReady = true;
}

function deviceOf(request: Request): string {
  const ua = request.headers.get('User-Agent') || '';
  if (/bot|crawl|spider|headless/i.test(ua)) return 'bot';
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/** Logs one model call for the dashboard. Never throws: a logging failure must not fail the call. */
export async function recordEvent(request: Request, env: AccountEnv, user: SessionUser | null, info: EventInfo): Promise<void> {
  if (!env.DB) return;
  try {
    await ensureEvents(env.DB);
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO events (ts, day, kind, account, visitor, domain, depth, language, outcome, model, ms, country, device, own_key)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
    )
      .bind(
        now,
        now.slice(0, 10),
        info.kind,
        user ? accountKey(user) : null,
        // Already a salted hash of the IP; a prefix is plenty to count distinct visitors.
        (await ipKey(request, env)).slice(0, 16),
        short(info.domain, 40),
        short(info.depth, 20),
        short(info.language, 10),
        info.outcome,
        short(info.model, 80),
        typeof info.ms === 'number' ? Math.round(info.ms) : null,
        short((request as any).cf?.country, 4),
        deviceOf(request),
        info.ownKey ? 1 : 0
      )
      .run();
  } catch (err) {
    console.warn('[Admin] Could not record the event:', err);
  }
}

export function isAdminUser(env: AccountEnv, user: SessionUser | null): boolean {
  return Boolean(user && adminEmails(env).includes(user.email.toLowerCase()));
}

export async function handleAdmin(request: Request, env: AccountEnv, user: SessionUser | null, pathname: string): Promise<Response> {
  if (!isAdminUser(env, user)) {
    const reason = !user ? 'signed_out' : adminEmails(env).length ? 'not_admin' : 'no_admins';
    return json(403, { error: { code: 403, reason, email: user?.email || null } });
  }
  if (!env.DB) return json(503, { error: { code: 503, message: 'The database is not configured.' } });
  const db = env.DB;
  await ensureSchema(db);
  await ensureEvents(db);
  await ensureHistoryTable(db);
  await ensureFeedbackTable(db);

  if (pathname === '/api/admin/stats') {
    if (request.method !== 'GET') return json(405, { error: { code: 405, message: 'Use GET.' } });
    const asked = Number(new URL(request.url).searchParams.get('days'));
    const days = [7, 30, 90].includes(asked) ? asked : 30;
    return json(200, await stats(db, days, user!.email));
  }
  if (pathname === '/api/admin/delete-user') {
    if (request.method !== 'POST') return json(405, { error: { code: 405, message: 'Use POST.' } });
    const body: any = await request.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return json(400, { error: { code: 400, message: 'email is required.' } });
    if (adminEmails(env).includes(email)) return json(400, { error: { code: 400, message: 'An admin account cannot be deleted here.' } });
    await deleteAccount(db, email);
    return json(200, { ok: true });
  }
  return json(404, { error: { code: 404, message: 'Not found.' } });
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

async function all(db: D1Database, sql: string, ...values: unknown[]): Promise<Row[]> {
  return (await db.prepare(sql).bind(...values).all<Row>()).results || [];
}

async function first(db: D1Database, sql: string, ...values: unknown[]): Promise<Row> {
  return (await db.prepare(sql).bind(...values).first<Row>()) || {};
}

const pct = (values: number[], p: number) => (values.length ? values[Math.min(values.length - 1, Math.floor((p / 100) * values.length))] : null);

async function stats(db: D1Database, days: number, viewer: string) {
  const end = today();
  const start = daysAgo(days - 1);
  const prevStart = daysAgo(2 * days - 1);
  const prevEnd = daysAgo(days);
  // Prompts made: a finished Generate call.
  const made = "kind = 'generate' AND outcome = 'ok'";

  const [usersTotal, newUsers, prevNewUsers] = await Promise.all([
    first(db, 'SELECT COUNT(DISTINCT lower(email)) AS n FROM users'),
    first(db, 'SELECT COUNT(*) AS n FROM (SELECT lower(email) e, MIN(created_at) c FROM users GROUP BY e) WHERE substr(c, 1, 10) >= ?1', start),
    first(
      db,
      'SELECT COUNT(*) AS n FROM (SELECT lower(email) e, MIN(created_at) c FROM users GROUP BY e) WHERE substr(c, 1, 10) BETWEEN ?1 AND ?2',
      prevStart,
      prevEnd
    ),
  ]);

  const periodTotals = (from: string, to: string) =>
    first(
      db,
      `SELECT
         SUM(${made}) AS prompts,
         SUM(kind = 'refine' AND outcome = 'ok') AS enhanced,
         SUM(kind = 'generate' AND outcome = 'clarify') AS clarify,
         SUM(outcome = 'error') AS errors,
         SUM(outcome = 'limit') AS limits,
         SUM(${made} AND account IS NOT NULL) AS signedInPrompts,
         COUNT(DISTINCT CASE WHEN outcome <> 'limit' THEN COALESCE(account, visitor) END) AS people,
         COUNT(DISTINCT account) AS accounts
       FROM events WHERE day BETWEEN ?1 AND ?2`,
      from,
      to
    );

  const [period, prev, todayRow, firstEvent, daily, signups, outcomes, latencies] = await Promise.all([
    periodTotals(start, end),
    periodTotals(prevStart, prevEnd),
    periodTotals(end, end),
    first(db, 'SELECT MIN(day) AS day FROM events'),
    all(
      db,
      `SELECT day,
         SUM(${made}) AS prompts,
         SUM(kind = 'refine' AND outcome = 'ok') AS enhanced,
         SUM(outcome = 'error') AS errors,
         COUNT(DISTINCT CASE WHEN outcome <> 'limit' THEN COALESCE(account, visitor) END) AS people
       FROM events WHERE day >= ?1 GROUP BY day`,
      start
    ),
    all(
      db,
      'SELECT substr(c, 1, 10) AS day, COUNT(*) AS n FROM (SELECT lower(email) e, MIN(created_at) c FROM users GROUP BY e) WHERE substr(c, 1, 10) >= ?1 GROUP BY day',
      start
    ),
    all(db, 'SELECT kind, outcome, COUNT(*) AS n FROM events WHERE day >= ?1 GROUP BY kind, outcome', start),
    all(db, `SELECT ms FROM events WHERE ${made} AND ms IS NOT NULL AND day >= ?1 ORDER BY id DESC LIMIT 5000`, start),
  ]);

  const breakdown = (column: string, where = made) =>
    all(db, `SELECT COALESCE(${column}, '') AS key, COUNT(*) AS n FROM events WHERE ${where} AND day >= ?1 GROUP BY key ORDER BY n DESC LIMIT 16`, start);
  const [domains, depths, languages, countries, devices, models] = await Promise.all([
    breakdown('domain'),
    breakdown('depth'),
    breakdown('language'),
    breakdown('country', "outcome <> 'limit'"),
    breakdown('device', "outcome <> 'limit'"),
    breakdown('model', "outcome = 'ok'"),
  ]);

  const ms = latencies.map((r) => Number(r.ms)).sort((a, b) => a - b);

  const [feedbackTotals, feedbackDaily, feedbackRecent, users, activity] = await Promise.all([
    first(
      db,
      `SELECT SUM(rating = 'up') AS up, SUM(rating = 'down') AS down,
         SUM(rating = 'up' AND substr(created_at, 1, 10) >= ?1) AS upPeriod,
         SUM(rating = 'down' AND substr(created_at, 1, 10) >= ?1) AS downPeriod
       FROM feedback`,
      start
    ),
    all(
      db,
      `SELECT substr(created_at, 1, 10) AS day, SUM(rating = 'up') AS up, SUM(rating = 'down') AS down
       FROM feedback WHERE substr(created_at, 1, 10) >= ?1 GROUP BY day`,
      start
    ),
    all(db, 'SELECT id, created_at, account, rating, domain, depth, language, request, prompt, comment FROM feedback ORDER BY id DESC LIMIT 50'),
    all(
      db,
      `WITH u AS (
         SELECT lower(email) AS email, MAX(name) AS name, MIN(created_at) AS created,
                MAX(id NOT LIKE 'email:%') AS google, MAX(id LIKE 'email:%') AS byEmail
         FROM users GROUP BY lower(email)
       ), us AS (
         SELECT substr(subject, 6) AS email, SUM(MIN(count, ${LIMITS.signedIn})) AS total,
                MAX(CASE WHEN count > 0 THEN day END) AS lastDay,
                SUM(CASE WHEN day = ?1 THEN MIN(count, ${LIMITS.signedIn}) ELSE 0 END) AS today
         FROM usage WHERE subject LIKE 'user:%' GROUP BY subject
       ), p AS (SELECT owner AS email, COUNT(*) AS saved FROM prompts GROUP BY owner),
       f AS (SELECT account AS email, COUNT(*) AS ratings FROM feedback WHERE account IS NOT NULL GROUP BY account),
       d AS (
         SELECT account AS email, domain, COUNT(*) AS n,
                ROW_NUMBER() OVER (PARTITION BY account ORDER BY COUNT(*) DESC) AS r
         FROM events WHERE account IS NOT NULL AND kind = 'generate' AND outcome = 'ok' GROUP BY account, domain
       )
       SELECT u.email, u.name, u.created, u.google, u.byEmail,
              COALESCE(us.total, 0) AS total, us.lastDay, COALESCE(us.today, 0) AS today,
              COALESCE(p.saved, 0) AS saved, COALESCE(f.ratings, 0) AS ratings, d.domain AS topDomain
       FROM u LEFT JOIN us ON us.email = u.email LEFT JOIN p ON p.email = u.email
              LEFT JOIN f ON f.email = u.email LEFT JOIN d ON d.email = u.email AND d.r = 1
       ORDER BY u.created DESC LIMIT 2000`,
      end
    ),
    all(db, 'SELECT ts, kind, account, domain, depth, language, outcome, ms, country, device, own_key AS ownKey FROM events ORDER BY id DESC LIMIT 100'),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    viewer,
    range: { days, start, end, prevStart, prevEnd },
    trackingSince: firstEvent.day || null,
    limits: LIMITS,
    users: { total: usersTotal.n || 0, newInRange: newUsers.n || 0, newInPrev: prevNewUsers.n || 0 },
    period,
    prev,
    today: todayRow,
    latency: { median: pct(ms, 50), p95: pct(ms, 95), samples: ms.length },
    daily,
    signups,
    outcomes,
    breakdowns: { domains, depths, languages, countries, devices, models },
    feedback: { totals: feedbackTotals, daily: feedbackDaily, recent: feedbackRecent },
    userList: users,
    activity,
  };
}
