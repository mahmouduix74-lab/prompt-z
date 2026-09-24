import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { handleHealth, handleModels, handleGenerate, handleRefine } from './src/server/api.js';
import { renderEvalPage, runEval } from './src/server/eval.js';

// This Express server is used for local development and for platforms that
// run a persistent Node process. In production the site runs on Cloudflare
// Workers (worker/index.ts); both share the handlers in src/server/api.ts
// so the two entry points cannot drift apart.

// Local runs read OPENROUTER_API_KEY from .env.local (or .env).
dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', async (req, res) => {
  const { status, body } = await handleHealth(undefined, 'check' in req.query);
  res.status(status).json(body);
});

app.get('/api/models', async (req, res) => {
  const userApiKey = (req.headers['x-api-key'] as string) || '';
  const { status, body } = await handleModels(userApiKey);
  res.status(status).json(body);
});

app.post('/api/generate', async (req, res) => {
  const userApiKey = (req.headers['x-api-key'] as string) || '';
  const { status, body } = await handleGenerate(req.body || {}, userApiKey);
  res.status(status).json(body);
});

app.post('/api/refine', async (req, res) => {
  const userApiKey = (req.headers['x-api-key'] as string) || '';
  const { status, body } = await handleRefine(req.body || {}, userApiKey);
  res.status(status).json(body);
});

app.get('/api/eval', async (req, res) => {
  const run = await runEval();
  if ('json' in req.query) res.json(run);
  else res.type('html').send(renderEvalPage(run));
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
