#!/usr/bin/env node
/**
 * Screenshot a design export's artboards, light and dark.
 *
 *   node render-artboards.mjs --design <export root> --version <artboards dir> \
 *     --out /tmp/shots [--only A,B] [--click Page:selector]... [--dismiss selector] [--escape] [--full]
 *
 * --dismiss clicks a selector (a modal's close button) on every page where
 * it exists, before the per-page clicks; --escape presses Escape instead.
 * A click that times out is recorded as an error, but the capture is still
 * written so the state can be seen.
 *
 * The pages need their runtime and an HTTP origin: the export folder is
 * served, any CDN scripts the pages reference are fetched once into
 * `<out>/.vendor` (keyed by full URL, so two versions of one file cannot
 * collide) and served from there. A page that throws, or that renders
 * nothing, fails the run.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { applyTheme, args, launch, shootAll, startServer } from './lib/browser.mjs';

const a = args({
  design: {},
  version: { default: 'version1' },
  out: { default: '/tmp/shots' },
  only: {},
  click: { multiple: true },
  escape: { type: 'boolean', default: false },
  dismiss: {},
  full: { type: 'boolean', default: false },
  port: { default: '8765' },
  settle: { default: '2500' },
});
if (!a.design) throw new Error('--design <export root> is required');
const design = resolve(a.design);
const pagesDir = join(design, a.version);
const out = resolve(a.out);
const vendor = join(out, '.vendor');
mkdirSync(vendor, { recursive: true });

const names = readdirSync(pagesDir)
  .filter((f) => f.endsWith('.html'))
  .map((f) => f.replace(/\.dc\.html$|\.html$/, ''))
  .filter((n) => !a.only || a.only.split(',').includes(n));
if (names.length === 0) throw new Error(`no artboards in ${pagesDir}`);

// Vendor every CDN script the pages or their support files reference.
const urls = new Set();
for (const f of readdirSync(pagesDir)) {
  if (!/\.(html|js)$/.test(f)) continue;
  for (const m of readFileSync(join(pagesDir, f), 'utf8').matchAll(/https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net|esm\.sh)\/[^"'\s)]+/g)) urls.add(m[0]);
}
const vendored = new Map();
for (const url of urls) {
  const file = join(vendor, `${createHash('sha1').update(url).digest('hex')}.js`);
  if (!existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`failed to fetch ${url}: ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  vendored.set(url, file);
}

const clicks = (a.click ?? []).map((c) => {
  const i = c.indexOf(':');
  return { page: c.slice(0, i), selector: c.slice(i + 1) };
});

const origin = `http://localhost:${a.port}`;
const server = await startServer('python3', ['-m', 'http.server', a.port], { cwd: design, url: `${origin}/${a.version}/` });
const browser = await launch();
let failures = [];
try {
  failures = await shootAll(browser, names, async (page, { name, theme, errors }) => {
    await page.route('https://**', (route) => {
      const file = vendored.get(route.request().url());
      return file ? route.fulfill({ body: readFileSync(file), contentType: 'application/javascript' }) : route.continue();
    });
    const file = existsSync(join(pagesDir, `${name}.dc.html`)) ? `${name}.dc.html` : `${name}.html`;
    await page.goto(`${origin}/${a.version}/${file}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(Number(a.settle));
    await applyTheme(page, theme);
    if (a.escape) await page.keyboard.press('Escape');
    if (a.dismiss) {
      const el = page.locator(a.dismiss).first();
      if (await el.count()) await el.click({ timeout: 5000 }).catch((e) => errors.push(`--dismiss: ${e.message.split('\n')[0]}`));
    }
    for (const c of clicks) {
      if (c.page !== name) continue;
      const el = page.locator(c.selector).first();
      if ((await el.count()) === 0) errors.push(`--click ${c.page}:${c.selector} matched nothing`);
      else await el.click({ timeout: 5000 }).catch((e) => errors.push(`--click ${c.page}:${c.selector}: ${e.message.split('\n')[0]}`));
    }
    await page.waitForTimeout(400);
    if ((await page.evaluate(() => document.body.innerText.trim().length)) === 0) errors.push('page rendered no text (runtime failed?)');
    await page.screenshot({ path: join(out, `${name}-${theme}.png`), fullPage: a.full });
  });
} finally {
  await browser.close();
  server.stop();
}
if (failures.length) {
  console.error(`${failures.length} capture(s) had errors`);
  process.exit(1);
}
