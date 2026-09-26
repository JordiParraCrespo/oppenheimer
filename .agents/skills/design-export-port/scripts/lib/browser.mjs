/**
 * Shared plumbing for the two shooters: argv, Playwright, a child server,
 * and a page loop that fails loudly.
 *
 * Playwright is resolved from whichever workspace package already depends
 * on it, never from a machine-specific path. Set
 * PLAYWRIGHT_MODULE to a package name or path to override the lookup, and
 * PLAYWRIGHT_CHROMIUM to a browser executable when the resolved Playwright
 * wants a build the machine does not have.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

/** parseArgs with every option a string; `multiple` ones collect repeats. */
export function args(options) {
  const spec = Object.fromEntries(
    Object.entries(options).map(([name, o]) => [name, { type: o.type ?? 'string', multiple: o.multiple ?? false, default: o.default }]),
  );
  return parseArgs({ options: spec, allowPositionals: false }).values;
}

/** Workspace packages that declare Playwright, found by reading their package.json. */
function playwrightHosts() {
  const hosts = [];
  for (const dir of readdirSync(REPO_ROOT, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name.startsWith('.') || dir.name === 'node_modules') continue;
    const candidates = [join(REPO_ROOT, dir.name)];
    for (const sub of readdirSync(candidates[0], { withFileTypes: true })) if (sub.isDirectory()) candidates.push(join(candidates[0], sub.name));
    for (const c of candidates) {
      const pkg = join(c, 'package.json');
      if (!existsSync(pkg)) continue;
      const json = JSON.parse(readFileSync(pkg, 'utf8'));
      const deps = { ...json.dependencies, ...json.devDependencies };
      if (deps.playwright || deps['@playwright/test']) hosts.push({ from: pkg, name: deps.playwright ? 'playwright' : '@playwright/test' });
    }
  }
  return hosts;
}

export async function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, ...playwrightHosts()].filter(Boolean);
  for (const c of candidates) {
    try {
      const target = typeof c === 'string' ? c : createRequire(c.from).resolve(c.name);
      const mod = await import(typeof c === 'string' && existsSync(c) ? c : target);
      const chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) return chromium;
    } catch {}
  }
  throw new Error('No workspace package declares Playwright. Add it to one, or set PLAYWRIGHT_MODULE.');
}

export async function launch() {
  const chromium = await loadPlaywright();
  return chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
}

/**
 * Start a child in its own process group, wait until `url` answers 200
 * (twice in a row, so a dev server mid-restart does not pass), and hand
 * back a `stop()` that kills the whole group.
 */
export async function startServer(command, argv, { cwd, url, timeoutMs = 60_000 }) {
  const child = spawn(command, argv, { cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let output = '';
  let spawnError = null;
  child.on('error', (e) => (spawnError = e));
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (d) => (output += d));
  const stop = () => {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
  };
  const deadline = Date.now() + timeoutMs;
  let okStreak = 0;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) break;
    try {
      const res = await fetch(url);
      okStreak = res.ok ? okStreak + 1 : 0;
      if (okStreak >= 2) return { stop };
    } catch {
      okStreak = 0;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  stop();
  throw new Error(`server at ${url} never answered 200 within ${timeoutMs / 1000}s\n${output.slice(-2000)}`);
}

/**
 * Run `fn(page, { name, theme, errors })` for every (name, theme) and
 * collect page errors and console errors. Returns the failures so the
 * caller can exit non-zero.
 */
export async function shootAll(browser, names, fn, { viewport = { width: 1440, height: 900 }, themes = ['light', 'dark'] } = {}) {
  const failures = [];
  for (const name of names) {
    for (const theme of themes) {
      const page = await browser.newPage({ viewport, ignoreHTTPSErrors: true });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      // Failed requests are reported with their URL from the response event;
      // the console's "Failed to load resource" line would only duplicate it.
      page.on('console', (m) => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
      page.on('response', (r) => r.status() >= 400 && !r.url().endsWith('/favicon.ico') && errors.push(`${r.status()} ${r.url()}`));
      try {
        await fn(page, { name, theme, errors });
      } catch (e) {
        errors.push(e.message);
      } finally {
        await page.close();
      }
      console.log(`${name} ${theme}${errors.length ? `\n  ${errors.join('\n  ')}` : ''}`);
      if (errors.length) failures.push({ name, theme, errors });
    }
  }
  return failures;
}

/** Apply a theme the way the token file keys it: both `.dark` and `data-theme`. */
export async function applyTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
}
