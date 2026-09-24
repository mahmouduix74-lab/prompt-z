/**
 * Google sign-in and daily prompt limits, for the Cloudflare Worker (worker/index.ts).
 *
 * - Visitors who are not signed in get LIMITS.anonymous prompts a day, counted per IP (stored hashed).
 * - Signed-in users get LIMITS.signedIn prompts a day, counted per Google account.
 * - "Enhance" and "Generate" both count, since both call the model.
 * - Days are UTC. Counts live in the D1 database bound as DB (wrangler.jsonc).
 *
 * The session cookie is signed with a key derived from GOOGLE_CLIENT_SECRET, so no extra secret is
 * needed. Without the Google variables sign-in is off and everyone gets LIMITS.signedIn; without
 * the DB binding there are no limits at all (fail open, never block the site on our own storage).
 */

/** The subset of Cloudflare's D1 API used here. */
export interface D1Database {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

export interface AccountEnv {
  DB?: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** The origin registered with Google, e.g. https://prpmtz.online. */
  SITE_ORIGIN?: string;
}

export const LIMITS = { anonymous: 3, signedIn: 6 };
/** /api/eval runs 10 model calls, so it is limited as a whole, for everyone together. */
const EVAL_RUNS_PER_DAY = 3;

const SESSION_COOKIE = 'pz_session';
const STATE_COOKIE = 'pz_oauth_state';
const SESSION_DAYS = 30;

export interface SessionUser {
  sub: string;
  email: string;
  name: string;
}

export interface Usage {
  used: number;
  limit: number;
  remaining: number;
}

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function sha256(text: string): Promise<string> {
  return base64url(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

async function hmacKey(env: AccountEnv): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', encoder.encode(`promptz-session:${env.GOOGLE_CLIENT_SECRET}`));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sign(env: AccountEnv, payload: string): Promise<string> {
  return base64url(await crypto.subtle.sign('HMAC', await hmacKey(env), encoder.encode(payload)));
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

function cookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function authEnabled(env: AccountEnv): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

function siteOrigin(env: AccountEnv, request: Request): string {
  return (env.SITE_ORIGIN || new URL(request.url).origin).replace(/\/$/, '');
}

/** The signed-in user from the session cookie, or null. */
export async function readSession(request: Request, env: AccountEnv): Promise<SessionUser | null> {
  if (!authEnabled(env)) return null;
  const value = readCookie(request, SESSION_COOKIE);
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;

  const expected = await sign(env, payload);
  if (expected.length !== signature.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  if (diff !== 0) return null;

  try {
    const data = JSON.parse(fromBase64url(payload));
    if (typeof data?.exp !== 'number' || data.exp < Date.now() / 1000 || typeof data.sub !== 'string') return null;
    return { sub: data.sub, email: String(data.email || ''), name: String(data.name || '') };
  } catch {
    return null;
  }
}

/** GET /api/auth/login: sends the browser to Google's sign-in page. */
export async function handleLogin(request: Request, env: AccountEnv): Promise<Response> {
  if (!authEnabled(env)) return new Response('Sign-in is not configured.', { status: 503 });
  const state = base64url(crypto.getRandomValues(new Uint8Array(24)));
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${siteOrigin(env, request)}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      'Set-Cookie': cookie(STATE_COOKIE, state, 600),
    },
  });
}

/** GET /api/auth/callback: Google sends the browser back here with a one-time code. */
export async function handleCallback(request: Request, env: AccountEnv): Promise<Response> {
  const origin = siteOrigin(env, request);
  const back = (query: string, setCookies: string[] = []) => {
    const headers = new Headers({ Location: `${origin}/${query}` });
    for (const c of [...setCookies, cookie(STATE_COOKIE, '', 0)]) headers.append('Set-Cookie', c);
    return new Response(null, { status: 302, headers });
  };

  if (!authEnabled(env)) return back('?signin=error');
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || state !== readCookie(request, STATE_COOKIE)) return back('?signin=error');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/auth/callback`,
      grant_type: 'authorization_code',
    }),
  });
  const tokens: any = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || typeof tokens?.id_token !== 'string') {
    console.warn('[Auth] Token exchange failed:', tokenRes.status, tokens?.error);
    return back('?signin=error');
  }

  // The ID token came straight from Google over TLS, so its payload can be read without re-verifying.
  let claims: any;
  try {
    claims = JSON.parse(fromBase64url(tokens.id_token.split('.')[1]));
  } catch {
    return back('?signin=error');
  }
  if (!claims?.sub || claims.aud !== env.GOOGLE_CLIENT_ID) return back('?signin=error');

  const user: SessionUser = { sub: String(claims.sub), email: String(claims.email || ''), name: String(claims.name || '') };
  if (env.DB) {
    try {
      await ensureSchema(env.DB);
      await env.DB.prepare(
        `INSERT INTO users (id, email, name, created_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name`
      )
        .bind(user.sub, user.email, user.name, new Date().toISOString())
        .run();
    } catch (err) {
      console.warn('[Auth] Could not save the user:', err);
    }
  }

  const payload = base64url(encoder.encode(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400 })));
  const session = `${payload}.${await sign(env, payload)}`;
  return back('?signin=ok', [cookie(SESSION_COOKIE, session, SESSION_DAYS * 86400)]);
}

/** GET /api/auth/logout */
export function handleLogout(request: Request, env: AccountEnv): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${siteOrigin(env, request)}/`, 'Set-Cookie': cookie(SESSION_COOKIE, '', 0) },
  });
}

let schemaReady = false;

async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, name TEXT, created_at TEXT)').bind().run();
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS usage (subject TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (subject, day))'
    )
    .bind()
    .run();
  schemaReady = true;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Who the request counts against, and their daily limit. */
async function quotaSubject(request: Request, env: AccountEnv, user: SessionUser | null) {
  if (user) return { subject: `user:${user.sub}`, limit: LIMITS.signedIn };
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  // Stored hashed (with the site's secret) so the database never holds raw IP addresses.
  const subject = `ip:${await sha256(`${env.GOOGLE_CLIENT_SECRET || 'promptz'}:${ip}`)}`;
  return { subject, limit: authEnabled(env) ? LIMITS.anonymous : LIMITS.signedIn };
}

/** Today's usage for the request's user or IP, without counting anything. */
export async function readUsage(request: Request, env: AccountEnv, user: SessionUser | null): Promise<Usage | null> {
  if (!env.DB) return null;
  try {
    await ensureSchema(env.DB);
    const { subject, limit } = await quotaSubject(request, env, user);
    const row = await env.DB.prepare('SELECT count FROM usage WHERE subject = ?1 AND day = ?2').bind(subject, today()).first<{ count: number }>();
    // Attempts past the limit are recorded too, so cap what is shown.
    const used = Math.min(row?.count ?? 0, limit);
    return { used, limit, remaining: Math.max(0, limit - used) };
  } catch (err) {
    console.warn('[Quota] Could not read usage:', err);
    return null;
  }
}

/**
 * Counts one model call. Returns the usage after counting, with allowed=false when the daily
 * limit was already reached (the attempt is still recorded, which is harmless).
 * Null means limits are unavailable (no DB or a DB error): the call goes ahead.
 */
export async function consumeQuota(
  request: Request,
  env: AccountEnv,
  user: SessionUser | null,
  kind: 'prompt' | 'eval' = 'prompt'
): Promise<(Usage & { allowed: boolean }) | null> {
  if (!env.DB) return null;
  try {
    await ensureSchema(env.DB);
    const { subject, limit } = kind === 'eval' ? { subject: 'eval', limit: EVAL_RUNS_PER_DAY } : await quotaSubject(request, env, user);
    const row = await env.DB.prepare(
      `INSERT INTO usage (subject, day, count) VALUES (?1, ?2, 1)
       ON CONFLICT(subject, day) DO UPDATE SET count = count + 1
       RETURNING count`
    )
      .bind(subject, today())
      .first<{ count: number }>();
    const used = Math.min(row?.count ?? 1, limit);
    return { allowed: (row?.count ?? 1) <= limit, used, limit, remaining: Math.max(0, limit - used) };
  } catch (err) {
    console.warn('[Quota] Could not count usage, allowing the request:', err);
    return null;
  }
}
