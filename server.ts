import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { handleHealth, handleModels, handleGenerate, handleRefine } from './src/server/geminiApi';

// This Express server is used for local development and for platforms that
// run a persistent Node process (AI Studio's own Publish button / Cloud Run).
// On Vercel, this file is never executed — the routes below are mirrored as
// individual serverless functions under /api, sharing the same handlers from
// src/server/geminiApi.ts so the two deployment targets cannot drift apart.

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  const { status, body } = handleHealth();
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
