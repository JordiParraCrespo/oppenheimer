#!/usr/bin/env node
/**
 * Start the built showcase and screenshot the top and named sections,
 * light and dark. Fails if the server never answers or a page logs errors.
 *
 *   pnpm --filter <scope>/web-showcase build
 *   node shoot-showcase.mjs --out /tmp/shots --sections colors,type,buttons [--app apps/web-showcase] [--port 3002]
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { REPO_ROOT, applyTheme, args, launch, shootAll, startServer } from './lib/browser.mjs';

const a = args({
  app: { default: 'apps/web-showcase' },
  out: { default: '/tmp/shots' },
  sections: { default: '' },
  port: { default: '3002' },
});
const out = resolve(a.out);
mkdirSync(out, { recursive: true });
const sections = a.sections.split(',').filter(Boolean);
const origin = `http://localhost:${a.port}`;

// Resolve Next from the app itself so no package manager needs to be on PATH.
const appDir = resolve(REPO_ROOT, a.app);
const nextBin = createRequire(join(appDir, 'package.json')).resolve('next/dist/bin/next');
const server = await startServer('node', [nextBin, 'start', '--port', a.port], { cwd: appDir, url: `${origin}/` });
const browser = await launch();
let failures = [];
try {
  failures = await shootAll(browser, ['showcase'], async (page, { theme }) => {
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
    await applyTheme(page, theme);
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(out, `showcase-${theme}-top.png`) });
    for (const id of sections) {
      const found = await page.evaluate((id) => {
        const el = document.getElementById(id);
        el?.scrollIntoView({ block: 'start' });
        return Boolean(el);
      }, id);
      if (!found) throw new Error(`no section with id "${id}"`);
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(out, `showcase-${theme}-${id}.png`) });
    }
  });
} finally {
  await browser.close();
  server.stop();
}
if (failures.length) process.exit(1);
