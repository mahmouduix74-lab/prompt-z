# PromptZ

**From first idea to final prompt — in one second.**

PromptZ turns a rough idea, written in Arabic or English, into a clean, structured prompt that
another AI can run. Pick a domain and a detail level, choose the output language, and generate.
Prompts can be copied, downloaded as Markdown, and are kept in a local history.

Live: https://prompt-z.mahmouduix74.workers.dev

## How it works

- **Frontend:** React 19 + Vite + Tailwind CSS (`src/`).
- **API:** `/api/health`, `/api/models`, `/api/generate`, `/api/refine`. All four are handled by
  [`src/server/api.ts`](src/server/api.ts), which calls OpenRouter
  (`https://openrouter.ai/api/v1/chat/completions`, model `google/gemini-2.0-flash-001`).
- **Fallback:** if there is no key or OpenRouter fails, a local engine builds the prompt, so the
  user is never blocked.
- **Hosting:** Cloudflare Workers. [`worker/index.ts`](worker/index.ts) serves `/api/*` and the
  built site in `dist/` (see [`wrangler.jsonc`](wrangler.jsonc)).

`server.ts` is an Express server for running the same API locally with Node. It and the Worker
share the handlers in `src/server/api.ts`, so **change API behaviour there**, not in one entry point.

## Run locally

Prerequisite: Node.js 20+.

```bash
npm install
cp .env.example .env.local   # then put your OpenRouter key in it
npm run dev                  # http://localhost:3000
```

To run the real Worker locally instead: put the key in `.dev.vars` (see `.dev.vars.example`) and
run `npm run cf:dev`.

## Deploy (Cloudflare Workers Builds)

Every push to `main` deploys automatically. Dashboard settings (Workers & Pages → prompt-z →
Settings → Builds):

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Deploy command | `npm run deploy:ci` |
| Non-production deploy command | `npm run preview:ci` |
| Variables and secrets | `OPENROUTER_API_KEY` (type Secret) |

`deploy:ci` ([`scripts/cf-deploy.mjs`](scripts/cf-deploy.mjs)) runs `wrangler deploy` and uploads
the build's `OPENROUTER_API_KEY` as the Worker's runtime secret, so the key is entered in one
place only. Check it with `/api/health` → `"hasServerKey": true`.

Manual deploy from a machine logged in with `npx wrangler login`: `npm run deploy`.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Local Express server with Vite (port 3000) |
| `npm run build` | Build the site into `dist/` (and the Node server bundle) |
| `npm run lint` | Type-check with `tsc` |
| `npm run cf:dev` | Run the Cloudflare Worker locally |
| `npm run deploy` | Deploy to Cloudflare with `wrangler` |

## Promo video

`promo/` is a separate [Remotion](https://www.remotion.dev) project with the PromptZ promo videos.
See its `package.json` for the capture and render scripts.
