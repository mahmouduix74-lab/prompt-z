/**
 * Workers Builds deploy step: `npm run deploy:ci` (production) or `npm run preview:ci` (branches).
 *
 * Runs `wrangler deploy` / `wrangler preview` and uploads the RUNTIME_SECRETS that are set in the
 * build environment (Settings → Builds → Variables and secrets) with the deployment as runtime
 * secrets, so the build variables are the only place they have to be entered.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mode = process.argv[2] === 'preview' ? 'preview' : 'deploy';
const args = [mode];
let dir;

// Build variables that the Worker needs at runtime (build variables are not runtime variables).
const RUNTIME_SECRETS = ['OPENROUTER_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
const secrets = {};
for (const name of RUNTIME_SECRETS) {
  const value = (process.env[name] || '').trim();
  if (value) secrets[name] = value;
}

const found = Object.keys(secrets);
if (found.length) {
  dir = mkdtempSync(path.join(tmpdir(), 'promptz-secrets-'));
  const file = path.join(dir, 'secrets.json');
  writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
  args.push('--secrets-file', file);
  console.log(`Uploading from the build environment as runtime secrets: ${found.join(', ')}.`);
}
const missing = RUNTIME_SECRETS.filter((name) => !secrets[name]);
if (missing.length) console.log(`Not set in the build environment (the Worker keeps its existing values): ${missing.join(', ')}.`);

const result = spawnSync('npx', ['wrangler', ...args], { stdio: 'inherit', shell: process.platform === 'win32' });
if (dir) rmSync(dir, { recursive: true, force: true });
process.exit(result.status ?? 1);
