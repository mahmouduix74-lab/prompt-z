/**
 * Google sign-in and daily prompt limits, for the Cloudflare Worker (worker/index.ts).
 *
 * - Visitors who are not signed in get LIMITS.anonymous prompts a day, counted per IP (stored hashed).
 * - Signed-in users get LIMITS.signedIn prompts a day, counted per Google account.
 * - "Enhance" and "Generate" both count, since both call the model.
 * - Days are UTC. Counts live in the D1 database bound as DB (wrangler.jsonc).
 *
 * Two ways to sign in: Google (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET) and an emailed one-time
 * link (RESEND_API_KEY, sent through Resend). Both end in the same session, and an account is its
 * email address, so the same person gets one daily count whichever way they sign in.
 *
 * The session cookie is signed with a key derived from GOOGLE_CLIENT_SECRET (or RESEND_API_KEY), so
 * no extra secret is needed. With neither configured sign-in is off and everyone gets
 * LIMITS.signedIn; without the DB binding there are no limits at all (fail open, never block the
 * site on our own storage).
 */

/** The subset of Cloudflare's D1 API used here. */
export interface D1Database {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
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
  /** Resend API key, for emailed sign-in links. */
  RESEND_API_KEY?: string;
  /** Sender of sign-in emails; its domain must be verified in Resend. */
  EMAIL_FROM?: string;
  /** Comma-separated emails allowed to read the feedback page (/api/feedback). */
  ADMIN_EMAILS?: string;
}

// signedIn is a quiet abuse cap while credits are hidden (SHOW_CREDITS in constants.ts).
export const LIMITS = { anonymous: 3, signedIn: 50 };
/** /api/eval runs 10 model calls, so it is limited as a whole, for everyone together. */
const EVAL_RUNS_PER_DAY = 3;

const SESSION_COOKIE = 'pz_session';
const STATE_COOKIE = 'pz_oauth_state';
const SESSION_DAYS = 30;
const EMAIL_LINK_MINUTES = 15;
/** Sign-in emails a day, per address and per IP, so the form cannot be used to spam. */
const EMAIL_LINKS_PER_DAY = 5;

export interface SessionUser {
  sub: string;
  email: string;
  name: string;
  /** Profile photo URL (Google accounts only). */
  picture?: string;
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

/** The server-side secret that session signatures and IP hashes are derived from. */
function siteSecret(env: AccountEnv): string {
  return env.GOOGLE_CLIENT_SECRET || env.RESEND_API_KEY || '';
}

async function hmacKey(env: AccountEnv): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', encoder.encode(`promptz-session:${siteSecret(env)}`));
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

export function googleEnabled(env: AccountEnv): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function emailEnabled(env: AccountEnv): boolean {
  return Boolean(env.RESEND_API_KEY && env.DB);
}

/** Whether any way of signing in is configured. */
export function authEnabled(env: AccountEnv): boolean {
  return googleEnabled(env) || emailEnabled(env);
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
    const picture = typeof data.picture === 'string' && data.picture.startsWith('https://') ? data.picture : undefined;
    return { sub: data.sub, email: String(data.email || ''), name: String(data.name || ''), picture };
  } catch {
    return null;
  }
}

/** GET /api/auth/login: sends the browser to Google's sign-in page. */
export async function handleLogin(request: Request, env: AccountEnv): Promise<Response> {
  if (!googleEnabled(env)) return new Response('Sign-in is not configured.', { status: 503 });
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

  if (!googleEnabled(env)) return back('?signin=error');
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

  const picture = typeof claims.picture === 'string' && claims.picture.startsWith('https://') ? claims.picture : undefined;
  const user: SessionUser = { sub: String(claims.sub), email: String(claims.email || ''), name: String(claims.name || ''), picture };
  return back('?signin=ok', [await startSession(request, env, user)]);
}

/** Saves the user and returns the Set-Cookie value of a new signed session. */
async function startSession(request: Request, env: AccountEnv, user: SessionUser): Promise<string> {
  if (env.DB) {
    try {
      await ensureSchema(env.DB);
      await carryOverAnonymousUsage(request, env, user);
      await env.DB.prepare(
        `INSERT INTO users (id, email, name, created_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = CASE WHEN excluded.name <> '' THEN excluded.name ELSE users.name END`
      )
        .bind(user.sub, user.email, user.name, new Date().toISOString())
        .run();
    } catch (err) {
      console.warn('[Auth] Could not save the user:', err);
    }
  }
  const payload = base64url(encoder.encode(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400 })));
  return cookie(SESSION_COOKIE, `${payload}.${await sign(env, payload)}`, SESSION_DAYS * 86400);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * POST /api/auth/email { email, lang }: emails a one-time sign-in link, valid EMAIL_LINK_MINUTES.
 * Only a hash of the token is stored, and each address and IP gets EMAIL_LINKS_PER_DAY emails.
 */
export async function handleEmailLink(request: Request, env: AccountEnv): Promise<Response> {
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  if (!emailEnabled(env)) return reply(503, { error: { code: 503, message: 'Email sign-in is not configured.' } });

  const body: any = await request.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  const ar = body?.lang !== 'en';
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return reply(400, { error: { code: 400, reason: 'invalid_email', message: 'Enter a valid email address.' } });
  }

  const db = env.DB!;
  await ensureSchema(db);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  for (const subject of [`mail:${await sha256(email)}`, `mailip:${await sha256(`${siteSecret(env)}:${ip}`)}`]) {
    const row = await db
      .prepare(
        `INSERT INTO usage (subject, day, count) VALUES (?1, ?2, 1)
         ON CONFLICT(subject, day) DO UPDATE SET count = count + 1 RETURNING count`
      )
      .bind(subject, today())
      .first<{ count: number }>();
    if ((row?.count ?? 1) > EMAIL_LINKS_PER_DAY) {
      return reply(429, { error: { code: 429, reason: 'too_many_emails', message: 'Too many sign-in emails today.' } });
    }
  }

  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const expires = Date.now() + EMAIL_LINK_MINUTES * 60_000;
  await db.prepare('DELETE FROM login_tokens WHERE expires_at < ?1').bind(Date.now()).run();
  await db.prepare('INSERT INTO login_tokens (token_hash, email, expires_at) VALUES (?1, ?2, ?3)').bind(await sha256(token), email, expires).run();

  const link = `${siteOrigin(env, request)}/api/auth/email/verify?token=${token}`;
  const subject = ar ? 'رابط تسجيل الدخول إلى PromptZ' : 'Your PromptZ sign-in link';
  const html = ar
    ? `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:16px;line-height:1.7">
<p>مرحبًا،</p><p>اضغط الزر لتسجيل الدخول إلى PromptZ. الرابط صالح ${EMAIL_LINK_MINUTES} دقيقة ولمرة واحدة.</p>
<p><a href="${link}" style="display:inline-block;background:#7132F5;color:#fff;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:bold">تسجيل الدخول</a></p>
<p style="color:#666;font-size:13px">إذا لم تطلب هذا الرابط فتجاهل الرسالة.</p></div>`
    : `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6">
<p>Hi,</p><p>Press the button to sign in to PromptZ. The link works once, for ${EMAIL_LINK_MINUTES} minutes.</p>
<p><a href="${link}" style="display:inline-block;background:#7132F5;color:#fff;padding:12px 22px;border-radius:12px;text-decoration:none;font-weight:bold">Sign in</a></p>
<p style="color:#666;font-size:13px">If you did not ask for this link, ignore this email.</p></div>`;

  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM || 'PromptZ <login@prpmtz.online>', to: [email], subject, html, text: `${subject}: ${link}` }),
  });
  if (!sent.ok) {
    console.warn('[Auth] Resend refused the email:', sent.status, await sent.text().catch(() => ''));
    return reply(502, { error: { code: 502, reason: 'email_failed', message: 'Could not send the email.' } });
  }
  return reply(200, { ok: true });
}

/** GET /api/auth/email/verify?token=…: the link from the email. Works once, then signs in. */
export async function handleEmailVerify(request: Request, env: AccountEnv): Promise<Response> {
  const origin = siteOrigin(env, request);
  const back = (query: string, setCookie?: string) =>
    new Response(null, { status: 302, headers: { Location: `${origin}/${query}`, ...(setCookie ? { 'Set-Cookie': setCookie } : {}) } });
  if (!emailEnabled(env)) return back('?signin=error');

  const token = new URL(request.url).searchParams.get('token') || '';
  if (!token) return back('?signin=error');
  const db = env.DB!;
  await ensureSchema(db);
  const row = await db
    .prepare('DELETE FROM login_tokens WHERE token_hash = ?1 RETURNING email, expires_at')
    .bind(await sha256(token))
    .first<{ email: string; expires_at: number }>();
  if (!row || row.expires_at < Date.now()) return back('?signin=expired');

  return back('?signin=ok', await startSession(request, env, { sub: `email:${row.email}`, email: row.email, name: '' }));
}

/** GET /api/auth/logout */
export function handleLogout(request: Request, env: AccountEnv): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${siteOrigin(env, request)}/`, 'Set-Cookie': cookie(SESSION_COOKIE, '', 0) },
  });
}

let schemaReady = false;

export async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT, name TEXT, created_at TEXT)').bind().run();
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS usage (subject TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (subject, day))'
    )
    .bind()
    .run();
  await db
    .prepare('CREATE TABLE IF NOT EXISTS login_tokens (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL)')
    .bind()
    .run();
  schemaReady = true;
}

const today = () => new Date().toISOString().slice(0, 10);

/** The account a user's data belongs to: the email address, so every sign-in method shares it. */
export function accountKey(user: SessionUser): string {
  return user.email.toLowerCase() || user.sub;
}

/** Who the request counts against, and their daily limit. */
async function ipSubject(request: Request, env: AccountEnv): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  // Stored hashed (with the site's secret) so the database never holds raw IP addresses.
  return `ip:${await sha256(`${siteSecret(env) || 'promptz'}:${ip}`)}`;
}

async function quotaSubject(request: Request, env: AccountEnv, user: SessionUser | null) {
  // An account is its email, so Google and email sign-in for the same address share one count.
  if (user) return { subject: `user:${accountKey(user)}`, limit: LIMITS.signedIn };
  return { subject: await ipSubject(request, env), limit: authEnabled(env) ? LIMITS.anonymous : LIMITS.signedIn };
}

/**
 * Signed-in prompts also count against the IP, so signing out after using the account's prompts
 * does not open a fresh anonymous allowance on the same connection.
 */
async function bumpIp(request: Request, env: AccountEnv, delta: 1 | -1): Promise<void> {
  const subject = await ipSubject(request, env);
  const sql =
    delta > 0
      ? `INSERT INTO usage (subject, day, count) VALUES (?1, ?2, 1) ON CONFLICT(subject, day) DO UPDATE SET count = count + 1`
      : 'UPDATE usage SET count = MAX(count - 1, 0) WHERE subject = ?1 AND day = ?2';
  await env.DB!.prepare(sql).bind(subject, today()).run();
}

/**
 * Prompts used today before signing in count toward the account's limit, so signing in adds
 * LIMITS.signedIn - LIMITS.anonymous prompts (as the limit popup promises), not a fresh allowance.
 */
async function carryOverAnonymousUsage(request: Request, env: AccountEnv, user: SessionUser): Promise<void> {
  const row = await env.DB!.prepare('SELECT count FROM usage WHERE subject = ?1 AND day = ?2')
    .bind(await ipSubject(request, env), today())
    .first<{ count: number }>();
  const used = Math.min(row?.count ?? 0, LIMITS.anonymous);
  if (!used) return;
  await env.DB!.prepare(
    `INSERT INTO usage (subject, day, count) VALUES (?1, ?2, ?3)
     ON CONFLICT(subject, day) DO UPDATE SET count = MAX(count, excluded.count)`
  )
    .bind(`user:${accountKey(user)}`, today(), used)
    .run();
}

/** A hash of the caller's IP (with the site's secret), for per-IP limits without storing the address. */
export async function ipKey(request: Request, env: AccountEnv): Promise<string> {
  return sha256(`${siteSecret(env) || 'promptz'}:${request.headers.get('CF-Connecting-IP') || 'unknown'}`);
}

/** Gives back one counted call (the model was down, or it asked questions instead of answering). */
export async function refundQuota(request: Request, env: AccountEnv, user: SessionUser | null): Promise<void> {
  if (!env.DB) return;
  try {
    const { subject } = await quotaSubject(request, env, user);
    await env.DB.prepare('UPDATE usage SET count = MAX(count - 1, 0) WHERE subject = ?1 AND day = ?2').bind(subject, today()).run();
    if (user) await bumpIp(request, env, -1);
  } catch (err) {
    console.warn('[Quota] Could not refund usage:', err);
  }
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
    const allowed = (row?.count ?? 1) <= limit;
    if (kind === 'prompt' && user && allowed) await bumpIp(request, env, 1);
    const used = Math.min(row?.count ?? 1, limit);
    return { allowed, used, limit, remaining: Math.max(0, limit - used) };
  } catch (err) {
    console.warn('[Quota] Could not count usage, allowing the request:', err);
    return null;
  }
}
