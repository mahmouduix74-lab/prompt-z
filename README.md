# PromptZ

**From first idea to final prompt — in one second.**

PromptZ turns a rough idea, written in Arabic or English, into a clean, structured prompt that
another AI can run. Pick a domain and a detail level, choose the output language, and generate.
Prompts can be copied, downloaded as Markdown, and are kept in a history (in the browser, or in
your account once you sign in).

Live: https://prpmtz.online (also https://prompt-z.mahmouduix74.workers.dev)

## How it works

- **Frontend:** React 19 + Vite + Tailwind CSS (`src/`).
- **API:** `/api/generate` and `/api/refine` (Enhance) are handled by
  [`src/server/api.ts`](src/server/api.ts), which calls OpenRouter
  (`https://openrouter.ai/api/v1/chat/completions`) with `google/gemini-3.1-flash-lite`, falling back to
  `google/gemini-3.8-flash` if it is unavailable (`OPENROUTER_MODELS` in `src/constants.ts`).
  `/api/health?check` shows whether OpenRouter accepts the key and serves each model.
- **Prompt pipeline:** the model reads the request and plans the prompt as a JSON brief: the kind
  of answer (create, information, review, edit), role, tasks, constraints, output format and, by
  depth, approach, acceptance criteria and open questions, all from the request. The domain only
  says whose expertise answers it (its standards are candidates for requests that create
  something). Code (`composePrompt` in [`src/prompting.ts`](src/prompting.ts)) lays the brief out in
  the depth's sections.
- **Auto-check:** before composing, `checkBrief` ([`src/briefCheck.ts`](src/briefCheck.ts)) checks the
  brief against the request: every line of the request is covered by a task, no constraint limits
  the work to some of the tasks ("navbar only"), outOfDomain holds only what the user wrote, and
  exclusions stay out of the tasks. On a problem the model is asked once to fix its brief; the fix
  is kept only if it leaves fewer problems. The eval page shows what was auto-fixed.
- **Clarifying questions:** when a request is too vague, `/api/generate` returns up to 3 optional
  questions (`clarify`) instead of a prompt; the answers are added to the request (`skipClarify`).
- **Busy model:** if OpenRouter fails, `/api/generate` returns 503 `model_unavailable` and the site
  offers a retry (the call is not counted). The local engine is used only when no key is set.
- **Feedback:** 👍 / 👎 under each prompt go to `/api/feedback` (D1 table `feedback`). Signed-in
  emails listed in `ADMIN_EMAILS` (a build variable) can read them at `/api/feedback`.
- **Eval:** signed in with an `ADMIN_EMAILS` account, open `/api/eval` to run 13 fixed requests through
  the live model and check each prompt automatically (`/api/eval?json` for JSON). Cases live in
  [`src/server/eval.ts`](src/server/eval.ts).
- **Security headers:** every page and API response is sent with `X-Frame-Options: DENY`,
  `nosniff`, HSTS and a strict referrer policy ([`public/_headers`](public/_headers) for the site,
  `SECURITY_HEADERS` in [`worker/index.ts`](worker/index.ts) for `/api/*`).
- **Abuse limits:** API writes must be JSON (so other sites cannot post on a visitor's behalf);
  IPv6 addresses are counted per /64; refunded calls (clarifying questions, model errors) are
  capped at 10 a day; a database error refuses model calls instead of skipping the limits;
  history saves are capped at 400 a day per account; `/api/health?check` and `/api/eval` are
  admin-only.
- **Sign-in and daily limits:** sign-in with Google or an emailed one-time link (sent through
  [Resend](https://resend.com), `RESEND_API_KEY`), and a daily prompt limit (3 a day without an
  account, then a popup asks the visitor to sign in; 50 a day per account as an abuse cap;
  Generate and Enhance both count) run in the Worker
  ([`src/server/account.ts`](src/server/account.ts)), with users and counts in the D1 database
  `promptz`. Credits are hidden for now: `SHOW_CREDITS` in [`src/constants.ts`](src/constants.ts)
  turns the header badge, the account-menu meter and the counts in the popups back on.
  Prompts used before signing in count toward the account's allowance, and prompts used while
  signed in count toward the connection's 3, so signing in or out never resets the day. A call
  that delivers nothing (model down, clarifying questions, Enhance fallback) is not counted. Days
  reset at 00:00 UTC. `/api/me` returns the sign-in state and today's usage, which the account menu
  and the sign-in popup show. Signed-in users' saved prompts
  (History) are stored per account through `/api/history` ([`src/server/history.ts`](src/server/history.ts));
  prompts saved in the browser before signing in move into the account. The local Express server has no
  limits.
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
| Variables and secrets | `OPENROUTER_API_KEY` and `GOOGLE_CLIENT_SECRET` and `RESEND_API_KEY` (type Secret), `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS` |

`deploy:ci` ([`scripts/cf-deploy.mjs`](scripts/cf-deploy.mjs)) runs `wrangler deploy` and uploads
the build's `OPENROUTER_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY` and `ADMIN_EMAILS` as the Worker's
runtime secrets, so they are entered in one place only. The Google OAuth client's redirect URI is
`https://prpmtz.online/api/auth/callback` (`SITE_ORIGIN` in `wrangler.jsonc`). Check it with `/api/health` → `"hasServerKey": true`.

Manual deploy from a machine logged in with `npx wrangler login`: `npm run deploy`.

## API routes

| Route | What it does |
| --- | --- |
| `POST /api/generate` | Request → structured prompt (or clarifying questions) |
| `POST /api/refine` | Enhance: tidies the request text |
| `GET /api/me` | Sign-in state and today's usage |
| `/api/auth/login`, `/api/auth/callback` | Google sign-in |
| `POST /api/auth/email`, `/api/auth/email/verify` | Emailed sign-in link |
| `/api/auth/logout` | Sign out |
| `GET/POST/DELETE /api/history` | Signed-in user's saved prompts |
| `POST /api/feedback`, `GET /api/feedback` | 👍 / 👎, and the admin page to read them |
| `GET /api/eval` | Runs the eval (admins only, 3 runs a day) |
| `GET /api/health`, `/api/models` | Status and the model in use |

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Local Express server with Vite (port 3000) |
| `npm run build` | Build the site into `dist/` (and the Node server bundle) |
| `npm run lint` | Type-check with `tsc` |
| `npm run cf:dev` | Run the Cloudflare Worker locally |
| `npm run deploy` | Deploy to Cloudflare with `wrangler` |

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `npm run lint` and
`npm run build` on every pull request and push to `main`.

## Promo video

`promo/` is a separate [Remotion](https://www.remotion.dev) project with the 16:9 PromptZ promo
(composition `PromoWeb`): the real site is captured frame by frame (`npm run capture`), then
`npm run render` renders it with voice-over and music. See `promo/package.json`.
