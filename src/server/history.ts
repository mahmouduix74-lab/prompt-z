/**
 * Saved prompts ("History") for signed-in users, in the D1 table `prompts`, so each account has its
 * own history on every device. Visitors who are not signed in keep theirs in the browser.
 *
 *   GET    /api/history          → { items }            newest first
 *   POST   /api/history          { items: [...] }       add or replace (also imports browser history)
 *   DELETE /api/history?id=…     one item;  ?all=1 everything
 */
import { accountKey, ensureSchema, type AccountEnv, type D1Database, type SessionUser } from './account.js';

/** Most prompts kept per account; older ones are dropped. */
const MAX_ITEMS = 100;
/** Largest single saved prompt, in characters of JSON. */
const MAX_ITEM_CHARS = 60_000;
const MAX_ITEMS_PER_POST = 100;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

let tableReady = false;

async function ensureTable(db: D1Database): Promise<void> {
  if (tableReady) return;
  await ensureSchema(db);
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS prompts (owner TEXT NOT NULL, id TEXT NOT NULL, timestamp INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (owner, id))'
    )
    .bind()
    .run();
  tableReady = true;
}

/** Keeps only the fields a saved prompt has, so the table never stores anything else. */
function cleanItem(raw: any): { id: string; timestamp: number; data: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.slice(0, 100) : '';
  const timestamp = Number(raw.timestamp);
  if (!id || !Number.isFinite(timestamp) || typeof raw.output !== 'string' || typeof raw.rawInput !== 'string') return null;
  const item = {
    id,
    rawInput: raw.rawInput,
    exclusions: typeof raw.exclusions === 'string' ? raw.exclusions : undefined,
    domain: String(raw.domain || 'general'),
    depth: String(raw.depth || 'medium'),
    outputLanguage: typeof raw.outputLanguage === 'string' ? raw.outputLanguage : undefined,
    model: String(raw.model || ''),
    output: raw.output,
    timestamp,
  };
  const data = JSON.stringify(item);
  return data.length > MAX_ITEM_CHARS ? null : { id, timestamp, data };
}

export async function handleHistory(request: Request, env: AccountEnv, user: SessionUser | null): Promise<Response> {
  if (!user) return json(401, { error: { code: 401, message: 'Sign in to sync your history.' } });
  if (!env.DB) return json(503, { error: { code: 503, message: 'History storage is not configured.' } });
  const db = env.DB;
  const owner = accountKey(user);

  try {
    await ensureTable(db);

    if (request.method === 'GET') {
      const rows = await db
        .prepare('SELECT data FROM prompts WHERE owner = ?1 ORDER BY timestamp DESC LIMIT ?2')
        .bind(owner, MAX_ITEMS)
        .all<{ data: string }>();
      const items = (rows.results || []).flatMap((r) => {
        try {
          return [JSON.parse(r.data)];
        } catch {
          return [];
        }
      });
      return json(200, { items });
    }

    if (request.method === 'POST') {
      const body: any = await request.json().catch(() => ({}));
      const items = (Array.isArray(body?.items) ? body.items : []).slice(0, MAX_ITEMS_PER_POST).map(cleanItem).filter(Boolean);
      for (const item of items as { id: string; timestamp: number; data: string }[]) {
        await db
          .prepare(
            `INSERT INTO prompts (owner, id, timestamp, data) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(owner, id) DO UPDATE SET timestamp = excluded.timestamp, data = excluded.data`
          )
          .bind(owner, item.id, item.timestamp, item.data)
          .run();
      }
      // Keep the newest MAX_ITEMS.
      await db
        .prepare(
          `DELETE FROM prompts WHERE owner = ?1 AND id NOT IN
             (SELECT id FROM prompts WHERE owner = ?1 ORDER BY timestamp DESC LIMIT ?2)`
        )
        .bind(owner, MAX_ITEMS)
        .run();
      return json(200, { saved: items.length });
    }

    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      if (url.searchParams.get('all') === '1') {
        await db.prepare('DELETE FROM prompts WHERE owner = ?1').bind(owner).run();
      } else {
        const id = url.searchParams.get('id') || '';
        if (!id) return json(400, { error: { code: 400, message: 'id is required.' } });
        await db.prepare('DELETE FROM prompts WHERE owner = ?1 AND id = ?2').bind(owner, id).run();
      }
      return json(200, { ok: true });
    }

    return json(405, { error: { code: 405, message: 'Use GET, POST or DELETE.' } });
  } catch (err) {
    console.warn('[History] Storage error:', err);
    return json(500, { error: { code: 500, message: 'Could not reach history storage.' } });
  }
}
