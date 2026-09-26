#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Lists the functions the React Compiler leaves uncompiled, and why.
 *
 * `apps/web` builds with `react({ compiler: true })`, which runs the oxc port of
 * the compiler with `panicThreshold: 'none'`: a component or hook it cannot
 * prove safe is shipped as written, unmemoised, and the build says nothing.
 * `react-compiler-healthcheck` runs the Babel compiler and misses these, so
 * this runs the same `transform` the Vite plugin runs, over every file the app
 * compiles, and prints what the compiler would have warned about.
 *
 * A bailout is not a bug on its own. It matters when the function sits on a
 * fast clock (a keystroke, a tick, a stream, a poll), where the memoisation it
 * lost is the thing that was keeping the cost down; the `frontend-audit` skill
 * judges that. This script only makes them visible.
 *
 *   node scripts/check-react-compiler.mjs            report, exit 0
 *   node scripts/check-react-compiler.mjs --json     the same, as JSON
 *   node scripts/check-react-compiler.mjs --strict   exit 1 when anything bails out
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// oppenheimer:begin web
/** The app whose build runs the compiler; `oxc-transform-react` is its dependency. */
const APP = 'apps/web';
// oppenheimer:end web
/** What the app compiles: its own source and every frontend package it bundles. */
const SOURCES = [
  // oppenheimer:begin web
  'apps/web/src',
  // oppenheimer:end web
  'packages/frontend/core/src',
  'packages/frontend/consumer/src',
  'packages/frontend/web/src',
  'packages/frontend/design-system/web/src',
];
// The Vite plugin's own filter: a file with no component or hook in it is not compiled.
const CODE_FILTER = /forwardRef|memo|\b(?:[A-Z]|use[A-Z0-9])/;
const SKIP = /(\.d\.ts|\.spec\.tsx?|\.test\.tsx?|routeTree\.gen\.ts)$|\/__tests__\//;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') yield* walk(path);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !SKIP.test(path)) yield path;
  }
}

function lineOf(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i += 1) if (source[i] === '\n') line += 1;
  return line;
}

async function main() {
  const json = process.argv.includes('--json');
  const strict = process.argv.includes('--strict');
  let transform;
  try {
    const require = createRequire(join(ROOT, APP, 'package.json'));
    ({ transform } = await import(require.resolve('oxc-transform-react')));
  } catch {
    console.error('oxc-transform-react is not installed; run `pnpm install` first.');
    process.exit(2);
  }

  const findings = [];
  let files = 0;
  for (const dir of SOURCES) {
    for (const file of walk(join(ROOT, dir))) {
      const source = readFileSync(file, 'utf8');
      if (!CODE_FILTER.test(source)) continue;
      files += 1;
      const result = await transform(file, source, {
        jsx: { runtime: 'automatic' },
        reactCompiler: {},
        sourcemap: false,
      });
      for (const error of result.errors) {
        const label = error.labels?.[0];
        findings.push({
          file: relative(ROOT, file),
          line: label ? lineOf(source, label.start) : null,
          reason: error.message.split('\n')[0],
          detail: label?.message ?? null,
        });
      }
    }
  }

  if (json) {
    console.log(JSON.stringify({ files, bailouts: findings }, null, 2));
  } else {
    for (const finding of findings) {
      const where = `${finding.file}${finding.line ? `:${finding.line}` : ''}`;
      console.log(`${where}  ${finding.reason}${finding.detail ? ` — ${finding.detail}` : ''}`);
    }
    const bailed = new Set(findings.map((finding) => finding.file)).size;
    console.log(
      `React Compiler: ${files} files compiled, ${bailed} with a function left uncompiled (${findings.length} diagnostics).`,
    );
  }
  if (strict && findings.length > 0) process.exit(1);
}

main();
