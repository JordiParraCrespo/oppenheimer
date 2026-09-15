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

/** Budget in KB of gzipped bytes on the critical path. */
const APPS = [
  // oppenheimer:begin web
  {
    name: '@oppenheimer/web',
    dist: 'apps/web/dist',
    // 371KB measured. The floor is ~108KB of Base UI and icons plus ~57KB of
    // React; the next real reduction is keeping a vendor chunk off the auth
    // screens, not shaving app code.
    budgetKB: 385,
  },
  // oppenheimer:end web
  // oppenheimer:begin admin-web
  {
    name: '@oppenheimer/admin-web',
    dist: 'apps/admin-web/dist',
    // 359KB measured — the same stack over fewer screens.
    budgetKB: 375,
  },
  // oppenheimer:end admin-web
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
