/**
 * Site visits and campaign links, for the admin dashboard's Traffic and Links pages.
 *
 *   POST /api/visit { ref, c, utm } once per browser session, from the site's pages (src/main.tsx)
 *
 * A visit stores the day, a hashed visitor key (the same one as `events.visitor`, so visits can be
 * matched to the prompts made), the country (from Cloudflare), the kind of device, where the
 * visitor came from and the campaign link used. No cookies, no IP addresses, no page content.
 *
 * Campaign links are prpmtz.online/?c=<slug>; an admin creates them in the dashboard.
 */
import { ipKey, type AccountEnv, type D1Database } from './account.js';

export const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'youtube', 'whatsapp', 'telegram', 'google', 'other'] as const;
export type Platform = (typeof PLATFORMS)[number];

/** Referrer hosts, by platform. Anything else is `other`; no referrer is `direct`. */
const HOSTS: [RegExp, Platform][] = [
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'x'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'],
  [/(^|\.)(t\.me|telegram\.org)$/, 'telegram'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
];

/** One visitor cannot add more than this many visits a day (a reload loop, a script). */
const VISITS_PER_VISITOR_PER_DAY = 30;
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;

let ready = false;

export async function ensureVisitTables(db: D1Database): Promise<void> {
  if (ready) return;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS visits (
         id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, day TEXT NOT NULL, visitor TEXT NOT NULL,
         country TEXT, device TEXT, source TEXT NOT NULL, campaign TEXT)`
    )
    .bind()
    .run();
  await db.prepare('CREATE INDEX IF NOT EXISTS visits_day ON visits (day)').bind().run();
  await db
    .prepare('CREATE TABLE IF NOT EXISTS campaigns (slug TEXT PRIMARY KEY, name TEXT NOT NULL, platform TEXT NOT NULL, created_at TEXT NOT NULL)')
    .bind()
    .run();
  ready = true;
}

export function deviceOf(request: Request): string {
  const ua = request.headers.get('User-Agent') || '';
  if (/bot|crawl|spider|headless|preview|facebookexternalhit/i.test(ua)) return 'bot';
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/** The visitor key stored with visits and events: a prefix of the salted IP hash. */
export async function visitorKey(request: Request, env: AccountEnv): Promise<string> {
  return (await ipKey(request, env)).slice(0, 16);
}

function sourceOf(referrer: string, utm: string, ownHost: string): string {
  const fromUtm = utm.toLowerCase().replace(/[^a-z]/g, '');
  const named = PLATFORMS.find((p) => p !== 'other' && fromUtm.startsWith(p === 'x' ? 'twitter' : p));
  if (named) return named;
  if (fromUtm === 'ig') return 'instagram';
  if (fromUtm === 'fb') return 'facebook';
  let host = '';
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return 'direct';
  }
  if (!host || host === ownHost) return 'direct';
  return HOSTS.find(([pattern]) => pattern.test(host))?.[1] || 'other';
}

export async function handleVisit(request: Request, env: AccountEnv): Promise<Response> {
  const done = new Response(null, { status: 204 });
  if (request.method !== 'POST' || !env.DB) return done;
  const device = deviceOf(request);
  if (device === 'bot') return done;
  try {
    const body: any = await request.json().catch(() => ({}));
    const db = env.DB;
    await ensureVisitTables(db);
    const now = new Date().toISOString();
    const day = now.slice(0, 10);
    const visitor = await visitorKey(request, env);
    const seen = await db.prepare('SELECT COUNT(*) AS n FROM visits WHERE day = ?1 AND visitor = ?2').bind(day, visitor).first<{ n: number }>();
    if ((seen?.n || 0) >= VISITS_PER_VISITOR_PER_DAY) return done;

    // Only links made in the dashboard count as campaigns; their platform is the source.
    const slug = String(body?.c || '').toLowerCase();
    const campaign = SLUG.test(slug) ? await db.prepare('SELECT slug, platform FROM campaigns WHERE slug = ?1').bind(slug).first<{ slug: string; platform: string }>() : null;
    const source = campaign?.platform || sourceOf(String(body?.ref || ''), String(body?.utm || ''), new URL(request.url).hostname);

    await db
      .prepare('INSERT INTO visits (ts, day, visitor, country, device, source, campaign) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
      .bind(now, day, visitor, String((request as any).cf?.country || '').slice(0, 4) || null, device, source, campaign?.slug || null)
      .run();
  } catch (err) {
    console.warn('[Visits] Could not record the visit:', err);
  }
  return done;
}

export interface CampaignInput {
  slug?: unknown;
  name?: unknown;
  platform?: unknown;
}

/** Creates or renames a campaign link. Returns an error message, or null when saved. */
export async function saveCampaign(db: D1Database, input: CampaignInput): Promise<string | null> {
  await ensureVisitTables(db);
  const slug = String(input.slug || '').trim().toLowerCase();
  const name = String(input.name || '').trim().slice(0, 80);
  const platform = PLATFORMS.includes(input.platform as Platform) ? (input.platform as Platform) : 'other';
  if (!SLUG.test(slug)) return 'The link code may use a-z, 0-9 and dashes (up to 40).';
  if (!name) return 'The name is required.';
  await db
    .prepare(
      `INSERT INTO campaigns (slug, name, platform, created_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(slug) DO UPDATE SET name = excluded.name, platform = excluded.platform`
    )
    .bind(slug, name, platform, new Date().toISOString())
    .run();
  return null;
}

export async function deleteCampaign(db: D1Database, slug: string): Promise<void> {
  await ensureVisitTables(db);
  await db.prepare('DELETE FROM campaigns WHERE slug = ?1').bind(slug).run();
}
