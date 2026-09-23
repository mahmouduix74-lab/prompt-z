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
   Preview deployments (pull requests, via `wrangler preview`) keep their own secrets:
   `npx wrangler preview secret put OPENROUTER_API_KEY` — without it a preview still works, using the local engine.
   Alternatively, put `OPENROUTER_API_KEY` in **Settings → Builds → Variables and secrets** and set the
   deploy commands to `npm run deploy:ci` / `npm run preview:ci`: every build then uploads it as the
   runtime secret (`scripts/cf-deploy.mjs`).
2. Deploy: `npm run deploy` (runs `vite build`, then `wrangler deploy`).
   With Workers Builds (Git integration), pushes to `main` run `npx wrangler deploy`, and other branches
   run `npx wrangler preview` (enabled by the `previews` block in `wrangler.jsonc`).

To run the Worker locally, put `OPENROUTER_API_KEY=...` in `.dev.vars` (see `.dev.vars.example`) and run `npm run cf:dev`.

## Both entry points share one backend

- **Cloudflare Workers** (production) runs `worker/index.ts`.
- **Node** (`npm run dev` locally, or `npm run build && npm start`) runs `server.ts`, an Express server.

Both call the same functions from
[`src/server/geminiApi.ts`](src/server/geminiApi.ts). **If you change how the
app talks to OpenRouter — a new field, a different fallback, a new
endpoint — make that change in `src/server/geminiApi.ts`.** Editing only
one entry point will make them behave differently from each other.
