#!/usr/bin/env node
/**
 * Render a Claude Design export's artboards to PNG, light and dark.
 *
 * The .dc.html pages need their runtime: React and Babel from unpkg, and an
 * HTTP origin (the runtime fetches the page itself, which `file://` forbids).
 * This script serves the design folder, vendors the CDN scripts once (curl
 * goes through the session's proxy; the browser may not trust it), routes
 * the page's requests to the vendored copies, and screenshots every artboard.
 *
 *   node render-artboards.mjs --design product/versions/mvp/design \
 *     --version version1 --out /tmp/shots [--only SignIn,AddHost] [--full]
 *
 * Interactions: pass --click "Name:selector" to click something before the
 * shot (repeatable), e.g. --click "FirstSession:.op-chipselect__trigger".
 * --escape closes an on-load modal first.
 *
 * Needs Playwright (the e2e package or a global install) and Chromium.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : null))
    .filter(Boolean),
);
const design = resolve(args.design ?? 'product/versions/mvp/design');
const version = args.version ?? 'version1';
const out = resolve(args.out ?? '/tmp/shots');
const only = typeof args.only === 'string' ? args.only.split(',') : null;
const clicks = [].concat(args.click ?? []).filter((c) => typeof c === 'string');
const port = Number(args.port ?? 8765);
mkdirSync(out, { recursive: true });

async function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, '/opt/node22/lib/node_modules/playwright/index.mjs', 'playwright', '@playwright/test'].filter(Boolean);
  for (const c of candidates) {
    try {
      return import(createRequire(import.meta.url).resolve(c));
    } catch {}
    try {
      if (existsSync(c)) return import(c);
    } catch {}
  }
  throw new Error('Playwright not found. pnpm add -D playwright, or set PLAYWRIGHT_MODULE to an install.');
}

// Vendor the CDN scripts the runtime loads.
const support = readFileSync(join(design, version, 'support.js'), 'utf8');
const urls = [...new Set(support.match(/https:\/\/unpkg\.com\/[^"'\s)]+\.js/g) ?? [])];
const vendor = join(out, '.vendor');
mkdirSync(vendor, { recursive: true });
for (const url of urls) {
  const file = join(vendor, url.split('/').pop());
  if (existsSync(file)) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

// Serve the design folder.
const server = spawn('python3', ['-m', 'http.server', String(port)], { cwd: design, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const pw = await loadPlaywright();
const chromium = pw.chromium ?? pw.default?.chromium;
if (!chromium) throw new Error('Playwright loaded but exposes no chromium export.');
// A workspace Playwright newer than the preinstalled browsers wants its own
// download; point it at the shared binary instead (PLAYWRIGHT_CHROMIUM=/path/to/chrome).
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const pages = readdirSync(join(design, version))
  .filter((f) => f.endsWith('.dc.html'))
  .map((f) => f.replace('.dc.html', ''))
  .filter((n) => !only || only.includes(n));

try {
  for (const name of pages) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route('https://unpkg.com/**', (route) =>
        route.fulfill({ body: readFileSync(join(vendor, route.request().url().split('/').pop())), contentType: 'application/javascript' }),
      );
      await page.goto(`http://localhost:${port}/${version}/${name}.dc.html`);
      await page.waitForTimeout(4000);
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      if (args.escape) await page.keyboard.press('Escape');
      for (const c of clicks) {
        const [target, selector] = c.split(':');
        if (target !== name) continue;
        const el = page.locator(selector).first();
        if (await el.count()) await el.click();
      }
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(out, `${name}-${theme}.png`), fullPage: Boolean(args.full) });
      console.log(`${name} ${theme}${errors.length ? `  errors: ${errors.join(' | ')}` : ''}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}
