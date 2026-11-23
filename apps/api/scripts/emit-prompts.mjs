#!/usr/bin/env node
/**
 * Writes each module's `domain/prompts/prompts.gen.ts` from the Markdown
 * beside it (`prompt-files.mjs` says what a prompt file is).
 *
 * The words a model is told are prose, so they are kept as prose; the API
 * imports them as a module, typed by id and by slot, so a prompt renamed or
 * a slot left unfilled does not compile, and nothing is read from disk at
 * run time. The module is committed, like the bots' guide
 * (`pnpm generate:guide`).
 *
 *   node scripts/emit-prompts.mjs          write the modules
 *   node scripts/emit-prompts.mjs --check  fail when a committed module is stale
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPrompts, renderPromptModule } from './prompt-files.mjs';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(apiRoot, 'src');

/** The `domain/prompts` directory of every module that has one. */
function promptDirs() {
  return readdirSync(srcDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(srcDir, entry.name, 'domain', 'prompts'))
    .filter((dir) => existsSync(dir));
}

const check = process.argv.includes('--check');
let stale = false;
for (const dir of promptDirs()) {
  const outputPath = join(dir, 'prompts.gen.ts');
  const where = relative(apiRoot, outputPath);
  const wanted = renderPromptModule(readPrompts(dir));
  if (!check) {
    writeFileSync(outputPath, wanted);
    console.log(`Wrote ${where}.`);
    continue;
  }
  const current = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
  if (current === wanted) {
    console.log(`${where} is current.`);
  } else {
    stale = true;
    console.error(
      `${where} is not what the Markdown beside it generates. Run \`pnpm --filter @oppenheimer/api generate:prompts\`.`,
    );
  }
}
if (stale) process.exit(1);
