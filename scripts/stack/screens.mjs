#!/usr/bin/env node
/**
 * The console photographed for a pull request, in one command an agent can
 * run without a prompt (`.claude/settings.json` allows `pnpm screens`):
 *
 *   pnpm screens /sessions /settings/profile anon:/login
 *   pnpm screens --phone --github /sessions/new
 *
 * Each route is taken light and dark into `.screenshots/` by the e2e
 * `screens` project (`e2e/tests/screens/screens.spec.ts`), against the stack
 * `stack.mjs up --web` started. `--phone` adds a 390px width to the 1440px
 * one; `--github` connects a stub GitHub installation first. It empties
 * `.screenshots/` first, so the folder never mixes two runs. Chromium is the
 * machine's own where it ships one (`/opt/pw-browsers/chromium`), so nothing
 * is downloaded.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHIPPED_CHROMIUM = '/opt/pw-browsers/chromium';

const routes = [];
const env = { ...process.env };
for (const arg of process.argv.slice(2)) {
  if (arg === '--phone') env.SCREENS_WIDTHS = '1440,390';
  else if (arg === '--github') env.SCREENS_GITHUB = '1';
  else if (arg.startsWith('-')) {
    console.error(`screens: unknown option ${arg}`);
    process.exit(2);
  } else routes.push(arg);
}
if (routes.length === 0) {
  console.error('screens: name at least one route, e.g. pnpm screens /sessions');
  process.exit(2);
}

const webUrl = new URL(process.env.WEB_URL ?? 'http://localhost:3000');
const up = await new Promise((done) => {
  const socket = connect({ port: Number(webUrl.port || 80), host: webUrl.hostname });
  socket.once('connect', () => {
    socket.destroy();
    done(true);
  });
  socket.once('error', () => done(false));
});
if (!up) {
  console.error(
    `screens: no console on ${webUrl.origin}; run node scripts/stack/stack.mjs up --web`,
  );
  process.exit(1);
}

// Every run starts empty, so the folder only ever holds pictures of this code.
rmSync(resolve(ROOT, '.screenshots'), { recursive: true, force: true });
env.SCREENS = routes.join(',');
if (!env.PLAYWRIGHT_CHROMIUM_PATH && existsSync(SHIPPED_CHROMIUM))
  env.PLAYWRIGHT_CHROMIUM_PATH = SHIPPED_CHROMIUM;
// oppenheimer:begin e2e
const result = spawnSync('pnpm', ['--filter', '@oppenheimer/e2e', 'screens'], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
// oppenheimer:end e2e
