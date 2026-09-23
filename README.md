<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/455259a1-f4ef-4146-a007-329ecd2a694b

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `OPENROUTER_API_KEY` in [.env.local](.env.local) to your OpenRouter API key
   (the app generates with `google/gemini-2.0-flash-001` through OpenRouter)
3. Run the app:
   `npm run dev`

## Deploy on Cloudflare Workers

The site is served by a Cloudflare Worker (`worker/index.ts`, configured in `wrangler.jsonc`):
the Vite build in `dist/` is served as static assets, and `/api/*` runs in the Worker.

1. Add the OpenRouter key as a Worker **secret** (once):
   `npx wrangler secret put OPENROUTER_API_KEY`
   — or in the dashboard: Workers & Pages → prompt-z → Settings → Variables and Secrets → Add → type *Secret*.
2. Deploy: `npm run deploy` (runs `vite build`, then `wrangler deploy`).
   With Workers Builds (Git integration), the default deploy command `npx wrangler deploy` does the same on every push.

To run the Worker locally, put `OPENROUTER_API_KEY=...` in `.dev.vars` (see `.dev.vars.example`) and run `npm run cf:dev`.

## Deployment targets share one backend

The app can run on three platforms, and all of them call the same logic:

- **Cloudflare Workers** runs `worker/index.ts`.
- **Node hosts** (`npm run dev`, or `npm run build && npm start`) run `server.ts`, an Express server.
- **Vercel** runs the files under `api/` instead — `server.ts` is never executed there.

All of them call the same functions from
[`src/server/geminiApi.ts`](src/server/geminiApi.ts). **If you change how the
app talks to OpenRouter — a new field, a different fallback, a new
endpoint — make that change in `src/server/geminiApi.ts`.** Editing only
one entry point will make the platforms behave differently from each other.
