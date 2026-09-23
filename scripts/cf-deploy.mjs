/**
 * Workers Builds deploy step: `npm run deploy:ci` (production) or `npm run preview:ci` (branches).
 *
 * Runs `wrangler deploy` / `wrangler preview` and, when OPENROUTER_API_KEY is set in the build
 * environment (Settings → Builds → Variables and secrets), uploads it with the deployment as a
 * runtime secret, so the build variable is the only place the key has to be entered.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mode = process.argv[2] === 'preview' ? 'preview' : 'deploy';
const args = [mode];
let dir;

const key = (process.env.OPENROUTER_API_KEY || '').trim();
if (key) {
  dir = mkdtempSync(path.join(tmpdir(), 'promptz-secrets-'));
  const file = path.join(dir, 'secrets.json');
  writeFileSync(file, JSON.stringify({ OPENROUTER_API_KEY: key }), { mode: 0o600 });
  args.push('--secrets-file', file);
  console.log('OPENROUTER_API_KEY found in the build environment; uploading it as a runtime secret.');
} else {
  console.log('OPENROUTER_API_KEY is not set in the build environment; keeping the Worker\'s existing secrets.');
}

const result = spawnSync('npx', ['wrangler', ...args], { stdio: 'inherit', shell: process.platform === 'win32' });
if (dir) rmSync(dir, { recursive: true, force: true });
process.exit(result.status ?? 1);
