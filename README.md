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

## Two deployment targets share one backend

This app runs on two different platforms, and both call the same logic:

- **AI Studio / Cloud Run** (via the Publish button, or `npm run build && npm start`) runs `server.ts`, an Express server.
- **Vercel** runs the files under `api/` instead — `server.ts` is never executed there.

Both `server.ts` and every file in `api/` call the same functions from
[`src/server/geminiApi.ts`](src/server/geminiApi.ts). **If you change how the
app talks to the Gemini API — a new field, a different fallback, a new
endpoint — make that change in `src/server/geminiApi.ts`.** Editing only
`server.ts` or only a file in `api/` will make the two platforms behave
differently from each other.
