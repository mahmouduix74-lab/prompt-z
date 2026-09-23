/**
 * Cloudflare Worker entry. /api/* runs the shared handlers from
 * src/server/geminiApi.ts (the same ones server.ts uses);
 * everything else is the Vite build in dist/, served as static assets.
 *
 * OPENROUTER_API_KEY is a Worker secret: `npx wrangler secret put OPENROUTER_API_KEY`,
 * or Settings → Variables and Secrets in the Cloudflare dashboard.
 */
import { handleGenerate, handleHealth, handleModels, handleRefine, type HandlerResult } from '../src/server/geminiApi';

interface Env {
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const userApiKey = request.headers.get('x-api-key') || '';
    const serverKey = env.OPENROUTER_API_KEY;

    switch (pathname) {
      case '/api/health':
        return json(handleHealth(serverKey));
      case '/api/models':
        return json(await handleModels(userApiKey, serverKey));
      case '/api/generate':
        if (request.method !== 'POST') return methodNotAllowed('POST');
        return json(await handleGenerate(await readJson(request), userApiKey, serverKey));
      case '/api/refine':
        if (request.method !== 'POST') return methodNotAllowed('POST');
        return json(await handleRefine(await readJson(request), userApiKey, serverKey));
      default:
        return json({ status: 404, body: { error: { code: 404, message: 'Not found.' } } });
    }
  },
};
