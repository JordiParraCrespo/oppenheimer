#!/usr/bin/env node
/**
 * Start the built showcase and screenshot it, light and dark. Fails if the
 * server never answers, a page logs errors, or a shot's target is missing.
 *
 *   pnpm --filter <scope>/web-showcase build
 *   node shoot-showcase.mjs --out /tmp/shots [--sections colors,type,buttons] [--app apps/web-showcase] [--port 3002]
 *     [--state 'section:tag:step;step;…']... [--elements shots.json] [--height 900] [--scale 1]
 *
 * Every capture is one shot, taken on a freshly loaded page in each theme,
 * after its steps run in order:
 *
 *   top        the top of the page                    showcase-<theme>-top.png
 *   --sections each section id, scrolled to the top   showcase-<theme>-<id>.png
 *   --state    one state of a section's demo, as an element shot of the
 *              section; steps scoped to the section    showcase-<theme>-<section>-<tag>.png
 *   --elements one component, the first match of a page-wide selector,
 *              padded 16px; steps page-wide            element-<theme>-<name>.png
 *
 * Steps:
 *
 *   click=<selector>   click the first match
 *   drag=<selector>    hold a file over the first match (dragenter, dragover;
 *                      never a drop), for overlays that only show mid-drag
 *   wait=<ms>          let a transition or a timer finish
 *   shot=viewport      shoot the viewport instead, for a popup that portals
 *                      outside its section
 *
 * Selectors are Playwright's, so `button:has-text("How to fix")` and
 * `[aria-label="Host link"] >> text=Back` both work; prefer a role or tag
 * over bare `text=`, which also matches a section's own description.
 *
 * `--elements` is a JSON file, so a selector can hold any character:
 *
 *   [{ "name": "bot-exchange", "selector": "#chatcards [data-slot=bot-exchange] >> xpath=.." },
 *    { "name": "proposed-rejected", "selector": "#chatcards [data-slot=proposed-file]",
 *      "steps": ["click=#chatcards button:has-text(\"Reject\")"] }]
 *
 * Element shots are the captures a person reviews: one per new component or
 * changed state, with --scale 2.
 *
 * The showcase scrolls inside its main column, so a section or element shot
 * only holds what fits the viewport: raise --height for a tall one.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { REPO_ROOT, applyTheme, args, launch, shootAll, startServer } from './lib/browser.mjs';

const a = args({
  app: { default: 'apps/web-showcase' },
  out: { default: '/tmp/shots' },
  sections: { default: '' },
  port: { default: '3002' },
  state: { multiple: true },
  elements: { default: '' },
  height: { default: '900' },
  scale: { default: '1' },
});

/** @typedef {{ kind: 'top' | 'section' | 'state' | 'element', file: (theme: string) => string, target?: string, steps: string[] }} Shot */

/** @type {Shot[]} */
const shots = [
  { kind: 'top', file: (t) => `showcase-${t}-top.png`, steps: [] },
  ...a.sections
    .split(',')
    .filter(Boolean)
    .map((id) => ({ kind: 'section', target: `[id="${id}"]`, file: (t) => `showcase-${t}-${id}.png`, steps: [] })),
  ...(a.state ?? []).map((spec) => {
    const [section, tag, steps = ''] = spec.split(/:(.*?):(.*)/s).filter((x) => x !== undefined && x !== '');
    if (!section || !tag) throw new Error(`--state "${spec}": expected section:tag:steps`);
    return { kind: 'state', target: `[id="${section}"]`, file: (t) => `showcase-${t}-${section}-${tag}.png`, steps: steps.split(';').filter(Boolean) };
  }),
  ...(a.elements ? JSON.parse(readFileSync(resolve(a.elements), 'utf8')) : []).map((el) => {
    if (!el.name || !el.selector) throw new Error(`--elements: every entry needs "name" and "selector" (${JSON.stringify(el)})`);
    return { kind: 'element', target: el.selector, file: (t) => `element-${t}-${el.name}.png`, steps: el.steps ?? [] };
  }),
];

const out = resolve(a.out);
mkdirSync(out, { recursive: true });
const origin = `http://localhost:${a.port}`;

/** Run click / drag / wait / shot steps inside `scope`; returns the shot override, if any. */
async function runSteps(page, scope, steps, label) {
  let override = null;
  for (const step of steps) {
    const i = step.indexOf('=');
    const [kind, arg] = [step.slice(0, i), step.slice(i + 1)];
    if (kind === 'wait') await page.waitForTimeout(Number(arg));
    else if (kind === 'shot') override = arg;
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
  return override;
}

/** One shot: load, theme, find, steps, capture. */
async function take(page, theme, shot) {
  const path = join(out, shot.file(theme));
  const label = shot.file(theme);
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await applyTheme(page, theme);
  await page.waitForTimeout(400);
  if (!shot.target) return page.screenshot({ path });

  // An element may only exist once its steps have run (a menu, a dialog),
  // so it is required after them; a section or a state's section, before.
  const target = page.locator(shot.target).first();
  const missing = async () => (await target.count()) === 0;
  if (shot.kind !== 'element' && (await missing())) throw new Error(`${label}: nothing matches ${shot.target}`);
  if (!(await missing())) await target.scrollIntoViewIfNeeded();
  if (shot.kind === 'section') await target.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const override = await runSteps(page, shot.kind === 'state' ? target : page, shot.steps, label);
  await page.waitForTimeout(400);
  if (await missing()) throw new Error(`${label}: nothing matches ${shot.target} after its steps`);

  if (override === 'viewport' || shot.kind === 'section') return page.screenshot({ path });
  if (shot.kind === 'state') return target.screenshot({ path });
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error(`${label}: ${shot.target} is not visible`);
  const pad = 16;
  return page.screenshot({
    path,
    clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + 2 * pad, height: box.height + 2 * pad },
  });
}

// Resolve Next from the app itself so no package manager needs to be on PATH.
const appDir = resolve(REPO_ROOT, a.app);
const nextBin = createRequire(join(appDir, 'package.json')).resolve('next/dist/bin/next');
const server = await startServer('node', [nextBin, 'start', '--port', a.port], { cwd: appDir, url: `${origin}/` });
const browser = await launch();
let failures = [];
try {
  failures = await shootAll(
    browser,
    ['showcase'],
    async (page, { theme }) => {
      for (const shot of shots) await take(page, theme, shot);
    },
    { viewport: { width: 1440, height: Number(a.height) }, scale: Number(a.scale) },
  );
} finally {
  await browser.close();
  server.stop();
}
if (failures.length) process.exit(1);
