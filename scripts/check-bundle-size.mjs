#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * Fails the build when an SPA's first load grows past its budget.
 *
 * What it measures is what a first-time visitor actually downloads before
 * anything renders: every script and stylesheet referenced from the built
 * `index.html`, gzipped at level 9 — the same level the Docker image
 * precompresses with, so the number matches what nginx serves. Route chunks are
 * deliberately excluded; they are fetched on navigation and are the thing
 * splitting is *for*.
 *
 * The budgets below are not aspirations, they are the measured size plus a
 * little headroom. Raising one is a decision, and a reviewable diff — which is
 * the point. Vite's own 500KB chunk warning is not: it prints on every build and
 * nothing fails, which is how ~1.1MB in one chunk went unnoticed.
 */
import { gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Each app's critical-path budget, in KB of gzipped bytes. */
const APPS = [
  // oppenheimer:begin web
  {
    name: '@oppenheimer/web',
    dist: 'apps/web/dist',
    // 435.4KB measured (2026-09-29): `vendor-react` 106.5KB, `vendor-ui`
    // 100.4KB, `vendor-forms` 36.8KB, the entry 30.5KB, `vendor-router` 30.2KB.
    // `manualChunks` puts every design-system component in one chunk the entry
    // loads, so a picker used on one lazy route is on the critical path; letting
    // design-system code follow its route is the fix, as its own measured diff.
    // Headroom is 4.6KB so the next drift fails while it is one change's worth.
    // Raised to 441KB on 2026-10-21 for the session chat view (0.7), measured
    // at 440.2KB: `vendor-ui` +0.2KB for the design system's inline chat
    // composer and animated folds, the entry and the stylesheet +0.1KB each
    // for its strings, the shimmer sweep and their classes. All of it is the
    // design system's, on the critical path for the reason above.
    // Raised to 442KB on 2026-10-21 for images in a bot's chat (#426),
    // measured at 441.5KB: the entry +0.5KB for the default locale's new
    // strings (`bots.chat.images.*`, `errors.byCode.BOTS_024`–`BOTS_028`);
    // the default catalog is bundled, so every string a screen shows lands
    // here. The upload and image code itself follows the bot's chat route.
    // Raised to 443KB on 2026-10-22 for a bot's subagents (#444), measured at
    // 442.1KB on a main that stood at 442.0KB with no headroom: the entry
    // +0.1KB for the default locale's `bots.chat.activity` strings for
    // `delegate` (its line, the live line and each subagent's status). The
    // icon is one the console already ships; the subagent lines follow the
    // bot's chat route.
    budgetKB: 443,
  },
  // oppenheimer:end web
];

/** Script and stylesheet URLs the entry HTML pulls in, as site-root paths. */
function initialAssets(html) {
  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)="\/([^"]+)"/g)) {
    const url = match[1];
    if (url.endsWith('.js') || url.endsWith('.css')) urls.add(url);
  }
  return [...urls].sort();
}

let failed = false;

for (const app of APPS) {
  const dist = join(ROOT, app.dist);
  let html;
  try {
    html = readFileSync(join(dist, 'index.html'), 'utf8');
  } catch {
    console.error(`✗ ${app.name}: no build found at ${app.dist} — run \`pnpm build\` first.`);
    failed = true;
    continue;
  }

  const assets = initialAssets(html);
  let total = 0;
  const rows = [];

  for (const asset of assets) {
    const file = join(dist, asset);
    try {
      statSync(file);
    } catch {
      console.error(`✗ ${app.name}: ${asset} is referenced by index.html but missing from dist.`);
      failed = true;
      continue;
    }
    const gzipped = gzipSync(readFileSync(file), { level: 9 }).length;
    total += gzipped;
    rows.push([asset, gzipped]);
  }

  const totalKB = total / 1024;
  const over = totalKB > app.budgetKB;
  failed ||= over;

  console.log(`\n${app.name} — first load, gzipped`);
  for (const [asset, gzipped] of rows.sort((a, b) => b[1] - a[1])) {
    console.log(`  ${(gzipped / 1024).toFixed(1).padStart(7)}KB  ${asset}`);
  }
  console.log(
    `  ${'─'.repeat(9)}\n  ${totalKB.toFixed(1).padStart(7)}KB  total` +
      ` (budget ${app.budgetKB}KB, ${over ? 'OVER by' : 'headroom'} ` +
      `${Math.abs(app.budgetKB - totalKB).toFixed(1)}KB)`,
  );
}

if (failed) {
  console.error(
    '\nFirst load is over budget. Either find the regression (`npx vite build` prints per-chunk' +
      ' sizes) or raise the budget in scripts/check-bundle-size.mjs on purpose.',
  );
  process.exit(1);
}

console.log('\nAll first-load budgets met.');
