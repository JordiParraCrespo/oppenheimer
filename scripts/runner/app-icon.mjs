#!/usr/bin/env node
// Renders apps/runner/packaging/macos/AppIcon.svg into AppIcon.icns beside it,
// the icon release.sh puts in OppenheimerRunner.app. Run it after changing the
// SVG and commit both: the release builds on Linux, where there is no iconutil,
// so the .icns is packed here from PNGs (every size macOS asks for, PNG inside).
//
//   node scripts/runner/app-icon.mjs [path/to/chromium]
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../apps/runner/packaging/macos');
const svg = readFileSync(join(dir, 'AppIcon.svg'), 'utf8');

// OSType → pixel size, the set iconutil writes for an .iconset.
const entries = [
  ['icp4', 16],
  ['icp5', 32],
  ['ic11', 32],
  ['ic12', 64],
  ['ic07', 128],
  ['ic13', 256],
  ['ic08', 256],
  ['ic14', 512],
  ['ic09', 512],
  ['ic10', 1024],
];

// An argument names a Chromium to use when Playwright's own is not installed.
const executablePath = process.argv[2];
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
const pngs = new Map();
for (const size of new Set(entries.map(([, size]) => size))) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  pngs.set(size, await page.screenshot({ omitBackground: true }));
}
await browser.close();

const chunks = entries.map(([type, size]) => {
  const data = pngs.get(size);
  const header = Buffer.alloc(8);
  header.write(type, 0, 'ascii');
  header.writeUInt32BE(data.length + 8, 4);
  return Buffer.concat([header, data]);
});
const body = Buffer.concat(chunks);
const head = Buffer.alloc(8);
head.write('icns', 0, 'ascii');
head.writeUInt32BE(body.length + 8, 4);
writeFileSync(join(dir, 'AppIcon.icns'), Buffer.concat([head, body]));
writeFileSync(join(dir, 'AppIcon.png'), pngs.get(1024));
console.log(`wrote ${join(dir, 'AppIcon.icns')} and AppIcon.png`);
