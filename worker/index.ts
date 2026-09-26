/**
 * Cloudflare Worker entry. /api/* runs the shared handlers from
 * src/server/api.ts (the same ones server.ts uses);
 * everything else is the Vite build in dist/, served as static assets.
 *
 * Google sign-in and the daily prompt limits (src/server/account.ts) run only here,
 * since they need the D1 database; the local Express server has no limits.
 *
 * Secrets: OPENROUTER_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and RESEND_API_KEY are
 * uploaded from the build variables by scripts/cf-deploy.mjs.
 */
import { handleGenerate, handleHealth, handleModels, handleRefine, type HandlerResult } from '../src/server/api';
import { renderEvalPage, runEval } from '../src/server/eval';
import { handleHistory } from '../src/server/history';
import { handleFeedback } from '../src/server/feedback';
import {
  adminEmails,
  authEnabled,
  consumeQuota,
  emailEnabled,
  refundQuota,
  googleEnabled,
  handleCallback,
  handleEmailLink,
  handleEmailVerify,
  handleLogin,
  handleLogout,
  LIMITS,
  readSession,
  readUsage,
  type AccountEnv,
} from '../src/server/account';

interface Env extends AccountEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  OPENROUTER_API_KEY?: string;
}

const json = ({ status, body }: HandlerResult) =>
  new Response(JSON.stringify(body), {
    status,
    // Usage and sign-in state change with every call; never serve a cached copy.
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const methodNotAllowed = (allowed: string) =>
  json({ status: 405, body: { error: { code: 405, message: `Method not allowed. Use ${allowed}.` } } });

async function readJson(request: Request): Promise<any> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

/**
 * Runs a model call (generate or refine) within the caller's daily limit. Requests with their own
 * key (x-api-key) or with no text are not counted: they cost the site nothing.
 */
async function withinLimit(
  request: Request,
  env: Env,
  body: any,
  userApiKey: string,
  run: () => Promise<HandlerResult>
): Promise<Response> {
  if (userApiKey || !String(body?.rawText || '').trim()) return json(await run());

  const user = await readSession(request, env);
  const usage = await consumeQuota(request, env, user);
  if (usage?.unavailable) {
    return json({
      status: 503,
      body: { error: { code: 503, reason: 'model_unavailable', message: 'The service is busy. Try again shortly.' } },
    });
  }
  if (usage && !usage.allowed) {
    return json({
      status: 429,
      body: {
        error: {
          code: 429,
          reason: 'daily_limit',
          message: 'Daily prompt limit reached.',
          signedIn: Boolean(user),
          canSignIn: !user && authEnabled(env),
        },
        usage,
      },
    });
  }

  const result = await run();
  const resultBody = result.body as Record<string, unknown> | null;
  // The model delivered nothing (it was down, it asked clarifying questions, or Enhance fell back
  // to the local tidy-up): not counted.
  if (usage && (result.status >= 400 || resultBody?.clarify || resultBody?.modelFailed)) {
    await refundQuota(request, env, user);
  } else if (usage && result.status === 200 && resultBody && typeof resultBody === 'object') {
    resultBody.usage = usage;
  }
  return json(result);
}

// Static files get the same headers from public/_headers.
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    // Every API write is JSON from the site's own pages. A cross-site form can only send text/plain
    // or form data without a CORS preflight, so requiring JSON stops other sites posting on a
    // visitor's behalf (spending their allowance and the site's credit).
    const writes = request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH';
    // The emailed sign-in button is a plain form; that route checks the Origin header instead.
    const formRoute = pathname === '/api/auth/email/verify';
    if (pathname.startsWith('/api/') && writes && !formRoute && !(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) {
      return withSecurityHeaders(json({ status: 415, body: { error: { code: 415, message: 'Send JSON (Content-Type: application/json).' } } }));
    }
    const response = await route(request, env);
    return pathname.startsWith('/api/') ? withSecurityHeaders(response) : response;
  },
};

async function isAdmin(request: Request, env: Env): Promise<boolean> {
  const user = await readSession(request, env);
  return Boolean(user && adminEmails(env).includes(user.email.toLowerCase()));
}

function withSecurityHeaders(response: Response): Response {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) secured.headers.set(name, value);
  return secured;
}

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname, searchParams } = new URL(request.url);
  if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

  const userApiKey = request.headers.get('x-api-key') || '';
  const serverKey = env.OPENROUTER_API_KEY;

  switch (pathname) {
    case '/api/health': {
      // ?check calls OpenRouter with the site's key; left open, it could be hammered to get the key rate-limited.
      const check = searchParams.has('check') && (await isAdmin(request, env));
      return json(await handleHealth(serverKey, check));
    }
    case '/api/models':
      return json(await handleModels(userApiKey, serverKey));
    case '/api/me': {
      const user = await readSession(request, env);
      const usage = await readUsage(request, env, user);
      return json({
        status: 200,
        body: {
          authEnabled: authEnabled(env),
          google: googleEnabled(env),
          email: emailEnabled(env),
          user: user && { name: user.name, email: user.email, picture: user.picture },
          usage,
          limits: LIMITS,
        },
      });
    }
    case '/api/auth/login':
      return handleLogin(request, env);
    case '/api/auth/callback':
      return handleCallback(request, env);
    case '/api/auth/logout':
      return handleLogout(request, env);
    case '/api/auth/email':
      if (request.method !== 'POST') return methodNotAllowed('POST');
      return handleEmailLink(request, env);
    case '/api/auth/email/verify':
      return handleEmailVerify(request, env);
    case '/api/feedback':
      return handleFeedback(request, env, await readSession(request, env));
    case '/api/history':
      return handleHistory(request, env, await readSession(request, env));
    case '/api/generate': {
      if (request.method !== 'POST') return methodNotAllowed('POST');
      const body = await readJson(request);
      return withinLimit(request, env, body, userApiKey, () => handleGenerate(body, userApiKey, serverKey));
    }
    case '/api/refine': {
      if (request.method !== 'POST') return methodNotAllowed('POST');
      const body = await readJson(request);
      return withinLimit(request, env, body, userApiKey, () => handleRefine(body, userApiKey, serverKey));
    }
    case '/api/eval': {
      // Each run makes about 20 model calls on the site's key, so only admins may start one.
      if (!(await isAdmin(request, env))) {
        return new Response('Sign in with an admin account (ADMIN_EMAILS) to run the eval.', {
          status: 403,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
      const quota = await consumeQuota(request, env, null, 'eval');
      if (quota && !quota.allowed) {
        return new Response(quota.unavailable ? 'The database is unavailable. Try again shortly.' : 'The eval already ran 3 times today. Try again tomorrow (UTC).', {
          status: quota.unavailable ? 503 : 429,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
      const run = await runEval(serverKey);
      if (searchParams.has('json')) return json({ status: 200, body: run });
      return new Response(renderEvalPage(run), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    default:
      return json({ status: 404, body: { error: { code: 404, message: 'Not found.' } } });
  }
}
