/**
 * 👍 / 👎 on generated prompts, so we can see which prompts people did not like and why.
 *
 *   POST /api/feedback  { rating: 'up' | 'down', request, prompt, domain, depth, outputLanguage, comment }
 *   GET  /api/feedback  a review page, only for signed-in emails listed in ADMIN_EMAILS
 *                       (?rating=down shows only 👎).
 */
import { accountKey, ensureSchema, ipKey, type AccountEnv, type D1Database, type SessionUser } from './account.js';

const PER_IP_PER_DAY = 40;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

let tableReady = false;

async function ensureTable(db: D1Database): Promise<void> {
  if (tableReady) return;
  await ensureSchema(db);
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS feedback (
         id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, account TEXT, rating TEXT NOT NULL,
         domain TEXT, depth TEXT, language TEXT, request TEXT, prompt TEXT, comment TEXT)`
    )
    .bind()
    .run();
  tableReady = true;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function handleFeedback(request: Request, env: AccountEnv, user: SessionUser | null): Promise<Response> {
  if (!env.DB) return json(503, { error: { code: 503, message: 'Feedback storage is not configured.' } });
  const db = env.DB;
  await ensureTable(db);

  if (request.method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const rating = body?.rating === 'up' || body?.rating === 'down' ? body.rating : null;
    if (!rating) return json(400, { error: { code: 400, message: 'rating must be "up" or "down".' } });

    const row = await db
      .prepare(
        `INSERT INTO usage (subject, day, count) VALUES (?1, ?2, 1)
         ON CONFLICT(subject, day) DO UPDATE SET count = count + 1 RETURNING count`
      )
      .bind(`fb:${await ipKey(request, env)}`, new Date().toISOString().slice(0, 10))
      .first<{ count: number }>();
    if ((row?.count ?? 1) > PER_IP_PER_DAY) return json(429, { error: { code: 429, message: 'Too much feedback today.' } });

    await db
      .prepare(
        `INSERT INTO feedback (created_at, account, rating, domain, depth, language, request, prompt, comment)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
      )
      .bind(
        new Date().toISOString(),
        user ? accountKey(user) : null,
        rating,
        text(body.domain, 40),
        text(body.depth, 20),
        text(body.outputLanguage, 10),
        text(body.request, 4000),
        text(body.prompt, 20000),
        text(body.comment, 1000)
      )
      .run();
    return json(200, { ok: true });
  }

  if (request.method === 'GET') {
    const admins = (env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!user || !admins.includes(user.email.toLowerCase())) {
      return new Response('Sign in with an admin account to see feedback.', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    const onlyDown = new URL(request.url).searchParams.get('rating') === 'down';
    const totals = await db
      .prepare("SELECT SUM(rating = 'up') AS up, SUM(rating = 'down') AS down FROM feedback")
      .bind()
      .first<{ up: number; down: number }>();
    const rows = await db
      .prepare(
        `SELECT created_at, account, rating, domain, depth, language, request, prompt, comment FROM feedback
         ${onlyDown ? "WHERE rating = 'down'" : ''} ORDER BY id DESC LIMIT 100`
      )
      .bind()
      .all<Record<string, string>>();
    return new Response(renderPage(totals?.up ?? 0, totals?.down ?? 0, rows.results || [], onlyDown), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return json(405, { error: { code: 405, message: 'Use GET or POST.' } });
}

const escape = (s: string) => (s || '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

function renderPage(up: number, down: number, rows: Record<string, string>[], onlyDown: boolean): string {
  const items = rows
    .map(
      (r) => `<details${r.rating === 'down' ? ' open' : ''}>
<summary><b class="${r.rating}">${r.rating === 'up' ? '👍' : '👎'}</b> ${escape(r.domain)} · ${escape(r.depth)} · ${escape(r.language)} <span>${escape(r.created_at.slice(0, 16).replace('T', ' '))}${r.account ? ` · ${escape(r.account)}` : ''}</span></summary>
${r.comment ? `<p class="comment" dir="auto">${escape(r.comment)}</p>` : ''}
<h3>Request</h3><pre dir="auto">${escape(r.request)}</pre>
<h3>Prompt</h3><pre dir="auto">${escape(r.prompt)}</pre>
</details>`
    )
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PromptZ feedback</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#111;--muted:#666;--line:#ddd;--up:#0a7d38;--down:#c62828}
@media (prefers-color-scheme:dark){:root{--bg:#111;--fg:#eee;--muted:#999;--line:#333;--up:#4ade80;--down:#f87171}}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;max-width:900px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:0 0 4px}p{margin:0 0 12px}a{color:inherit}
details{border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:0 0 10px}
summary{cursor:pointer}summary span{color:var(--muted);font-size:13px}
h3{font-size:13px;color:var(--muted);margin:10px 0 4px}.comment{color:var(--down);font-weight:600;margin-top:8px}
pre{white-space:pre-wrap;word-break:break-word;font-size:13px;margin:0}
</style></head><body>
<h1>👍 ${up} · 👎 ${down}</h1>
<p>${onlyDown ? '<a href="/api/feedback">Show all</a>' : '<a href="/api/feedback?rating=down">Show 👎 only</a>'} · latest 100</p>
${items || '<p>No feedback yet.</p>'}
</body></html>`;
}
