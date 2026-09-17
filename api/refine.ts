/**
 * Vercel Serverless Function — mirrors an Express route in server.ts.
 * Both call the exact same logic from src/server/geminiApi.ts, so this file
 * stays correct on its own. If you are adding NEW behaviour (not just fixing
 * something here), put it in src/server/geminiApi.ts, not directly in this
 * file or in server.ts — that is the one place both deployment targets read
 * from (AI Studio / Cloud Run via server.ts, and Vercel via this file).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleRefine } from '../src/server/geminiApi.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { code: 405, message: 'Method not allowed. Use POST.' } });
    return;
  }
  const userApiKey = (req.headers['x-api-key'] as string) || '';
  const { status, body } = await handleRefine(req.body || {}, userApiKey);
  res.status(status).json(body);
}
