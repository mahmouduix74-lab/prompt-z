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
  if (usage && (result.status >= 500 || resultBody?.clarify || resultBody?.modelFailed)) {
    await refundQuota(request, env, user);
  } else if (usage && result.status === 200 && resultBody && typeof resultBody === 'object') {
    resultBody.usage = usage;
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
