/**
 * Vercel Serverless Function — mirrors an Express route in server.ts.
 * Both call the exact same logic from src/server/geminiApi.ts, so this file
 * stays correct on its own. If you are adding NEW behaviour (not just fixing
 * something here), put it in src/server/geminiApi.ts, not directly in this
 * file or in server.ts — that is the one place both deployment targets read
 * from (AI Studio / Cloud Run via server.ts, and Vercel via this file).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleModels } from '../src/server/geminiApi';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userApiKey = (req.headers['x-api-key'] as string) || '';
  const { status, body } = await handleModels(userApiKey);
  res.status(status).json(body);
}
