/**
 * Cloudflare Worker entry. /api/* runs the shared handlers from
 * src/server/api.ts (the same ones server.ts uses);
 * everything else is the Vite build in dist/, served as static assets.
 *
 * Google sign-in and the daily prompt limits (src/server/account.ts) run only here,
 * since they need the D1 database; the local Express server has no limits.
 *
 * Secrets: OPENROUTER_API_KEY and GOOGLE_CLIENT_SECRET (plus GOOGLE_CLIENT_ID) are uploaded
 * from the build variables by scripts/cf-deploy.mjs.
 */
import { handleGenerate, handleHealth, handleModels, handleRefine, type HandlerResult } from '../src/server/api';
import { renderEvalPage, runEval } from '../src/server/eval';
import {
  authEnabled,
  consumeQuota,
  handleCallback,
  handleLogin,
  handleLogout,
  readSession,
  readUsage,
  type AccountEnv,
} from '../src/server/account';

interface Env extends AccountEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  OPENROUTER_API_KEY?: string;
}

const json = ({ status, body }: HandlerResult) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

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
  if (usage && result.status === 200 && result.body && typeof result.body === 'object') {
    (result.body as Record<string, unknown>).usage = usage;
  }
  return json(result);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname, searchParams } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const userApiKey = request.headers.get('x-api-key') || '';
    const serverKey = env.OPENROUTER_API_KEY;

    switch (pathname) {
      case '/api/health':
        return json(await handleHealth(serverKey, searchParams.has('check')));
      case '/api/models':
        return json(await handleModels(userApiKey, serverKey));
      case '/api/me': {
        const user = await readSession(request, env);
        const usage = await readUsage(request, env, user);
        return json({
          status: 200,
          body: { authEnabled: authEnabled(env), user: user && { name: user.name, email: user.email }, usage },
        });
      }
      case '/api/auth/login':
        return handleLogin(request, env);
      case '/api/auth/callback':
        return handleCallback(request, env);
      case '/api/auth/logout':
        return handleLogout(request, env);
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
        const quota = await consumeQuota(request, env, null, 'eval');
        if (quota && !quota.allowed) {
          return new Response('The eval already ran 3 times today. Try again tomorrow (UTC).', {
            status: 429,
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
  },
};
