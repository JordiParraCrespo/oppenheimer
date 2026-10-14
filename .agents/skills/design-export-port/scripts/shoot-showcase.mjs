#!/usr/bin/env node
/**
 * Start the built showcase and screenshot the top and named sections,
 * light and dark. Fails if the server never answers or a page logs errors.
 *
 *   pnpm --filter <scope>/web-showcase build
 *   node shoot-showcase.mjs --out /tmp/shots --sections colors,type,buttons [--app apps/web-showcase] [--port 3002]
 *     [--state 'section:tag:step;step;…']... [--element 'name|selector|step;…']... [--height 900] [--scale 1]
 *
 * A --state captures one state of a section's demo, as an element shot of
 * the section (`showcase-<theme>-<section>-<tag>.png`), after its steps run
 * in order on a freshly loaded page:
 *
 *   click=<selector>   click the first match inside the section
 *   drag=<selector>    hold a file over the first match (dragenter, dragover;
 *                      never a drop), for overlays that only show mid-drag
 *   wait=<ms>          let a transition or a timer finish
 *   shot=viewport      shoot the viewport instead of the section, for a
 *                      popup that portals outside it
 *
 * Selectors are Playwright's, scoped to the section, so
 * `button:has-text("How to fix")` and `[aria-label="Host link"] >> text=Back`
 * both work; prefer a role or tag over bare `text=`, which also matches the
 * section's own description.
 *
 * An --element shoots one component, not its section: the first match of
 * a page-wide Playwright selector, padded 16px, after the same steps (their
 * selectors page-wide too), as `element-<theme>-<name>.png`. Use it for the
 * captures a person reviews: one per new component or changed state, with
 * --scale 2. A selector holding `|` cannot be passed here.
 *
 *   --element 'bot-exchange|#chatcards [data-slot=bot-exchange] >> xpath=..'
 *   --element 'proposed-accepted|#chatcards [data-slot=proposed-file]|click=#chatcards button:has-text("Accept")'
 *
 * The showcase scrolls inside its main column, so an element shot only
 * holds what fits the viewport: raise --height for a tall section.
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
  state: { multiple: true },
  height: { default: '900' },
  element: { multiple: true },
  scale: { default: '1' },
});
const states = (a.state ?? []).map((spec) => {
  const [section, tag, steps = ''] = spec.split(/:(.*?):(.*)/s).filter((x) => x !== undefined && x !== '');
  if (!section || !tag) throw new Error(`--state "${spec}": expected section:tag:steps`);
  return { section, tag, steps: steps.split(';').filter(Boolean) };
});
const elements = (a.element ?? []).map((spec) => {
  const [name, selector, steps = ''] = spec.split('|');
  if (!name || !selector) throw new Error(`--element "${spec}": expected name|selector|steps`);
  return { name, selector, steps: steps.split(';').filter(Boolean) };
});
const out = resolve(a.out);
mkdirSync(out, { recursive: true });
const sections = a.sections.split(',').filter(Boolean);
const origin = `http://localhost:${a.port}`;

/** Run click / drag / wait / shot steps inside `scope`; returns the shot kind. */
async function runSteps(page, scope, steps, label) {
  let shot = 'section';
  for (const step of steps) {
    const i = step.indexOf('=');
    const [kind, arg] = [step.slice(0, i), step.slice(i + 1)];
    if (kind === 'wait') await page.waitForTimeout(Number(arg));
    else if (kind === 'shot') shot = arg;
    else if (kind === 'click') await scope.locator(arg).first().click({ timeout: 5000 });
    else if (kind === 'drag')
      await scope.locator(arg).first().evaluate((el) => {
        const dt = new DataTransfer();
        dt.items.add(new File(['x'], 'screenshot.png', { type: 'image/png' }));
        const at = { bubbles: true, cancelable: true, dataTransfer: dt };
        el.dispatchEvent(new DragEvent('dragenter', at));
        el.dispatchEvent(new DragEvent('dragover', at));
      });
    else throw new Error(`${label}: unknown step "${step}"`);
  }
  return shot;
}

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
    for (const st of states) {
      await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
      await applyTheme(page, theme);
      const section = page.locator(`[id="${st.section}"]`).first();
      if ((await section.count()) === 0) throw new Error(`--state: no section with id "${st.section}"`);
      await section.scrollIntoViewIfNeeded();
      const shot = await runSteps(page, section, st.steps, `--state ${st.section}:${st.tag}`);
      await page.waitForTimeout(400);
      const path = join(out, `showcase-${theme}-${st.section}-${st.tag}.png`);
      if (shot === 'viewport') await page.screenshot({ path });
      else await section.screenshot({ path });
    }
    for (const el of elements) {
      await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
      await applyTheme(page, theme);
      const target = page.locator(el.selector).first();
      if ((await target.count()) === 0) throw new Error(`--element ${el.name}: nothing matches "${el.selector}"`);
      await target.scrollIntoViewIfNeeded();
      await runSteps(page, page, el.steps, `--element ${el.name}`);
      await page.waitForTimeout(400);
      await target.scrollIntoViewIfNeeded();
      const box = await target.boundingBox();
      if (!box) throw new Error(`--element ${el.name}: "${el.selector}" is not visible`);
      const pad = 16;
      await page.screenshot({
        path: join(out, `element-${theme}-${el.name}.png`),
        clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + 2 * pad, height: box.height + 2 * pad },
      });
    }
  }, { viewport: { width: 1440, height: Number(a.height) }, scale: Number(a.scale) });
} finally {
  await browser.close();
  server.stop();
}
if (failures.length) process.exit(1);
