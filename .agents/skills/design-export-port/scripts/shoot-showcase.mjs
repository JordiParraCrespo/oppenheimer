#!/usr/bin/env node
/**
 * Screenshot the built showcase in light and dark: the top, then each
 * section id given with --sections. Prints page errors so a broken demo is
 * caught before the PR.
 *
 *   pnpm --filter @<scope>/web-showcase build
 *   node shoot-showcase.mjs --app apps/web-showcase --out /tmp/shots \
 *     --sections colors,type,buttons,fields,chipselect,dropdown,sidebar,terminal
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : null)).filter(Boolean),
);
const app = resolve(args.app ?? 'apps/web-showcase');
const out = resolve(args.out ?? '/tmp/shots');
const port = Number(args.port ?? 3002);
const sections = (args.sections ?? 'colors,type,buttons').split(',');
mkdirSync(out, { recursive: true });

async async function loadPlaywright() {
  for (const c of [process.env.PLAYWRIGHT_MODULE, '/opt/node22/lib/node_modules/playwright/index.mjs', 'playwright', '@playwright/test'].filter(Boolean)) {
    try {
      return await import(createRequire(import.meta.url).resolve(c));
    } catch {}
    if (existsSync(c)) return import(c);
  }
  throw new Error('Playwright not found.');
}

const server = spawn('npx', ['next', 'start', '--port', String(port)], { cwd: app, stdio: 'ignore' });
for (let i = 0; i < 30; i++) {
  try {
    if ((await fetch(`http://localhost:${port}/`)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

const pw = await loadPlaywright();
const chromium = pw.chromium ?? pw.default?.chromium;
if (!chromium) throw new Error('Playwright loaded but exposes no chromium export.');
// A workspace Playwright newer than the preinstalled browsers wants its own
// download; point it at the shared binary instead (PLAYWRIGHT_CHROMIUM=/path/to/chrome).
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`http://localhost:${port}/`);
    if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(out, `showcase-${theme}-top.png`) });
    for (const id of sections) {
      await page.evaluate((id) => document.getElementById(id)?.scrollIntoView({ block: 'start' }), id);
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(out, `showcase-${theme}-${id}.png`) });
    }
    console.log(theme, 'errors:', errors.length ? errors : 'none');
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
