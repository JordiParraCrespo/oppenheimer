#!/usr/bin/env node
/**
 * Write `protocol-schema/protocol.schema.json` from the Zod union, and
 * `protocol-schema/samples.json` from `src/protocol/samples.ts`.
 *
 * This runs in `pnpm --filter @oppenheimer/shared build`, right after `tsc`, not
 * as a script somebody has to remember: the artifact is what the Go structs are
 * generated from (`emit-link-protocol.cjs`, which runs next), so leaving it
 * behind a separate command is how it goes stale while `tsc` alone reports
 * success. The samples are the TypeScript tests' one message of every type; the
 * runner's `internal/link/protocol_test.go` decodes each strictly into the
 * generated structs, which is what catches a Zod field Go never learnt about.
 *
 * The output is plain, stable `JSON.stringify(…, null, 2)`. It is deliberately
 * not run through a formatter — the committed contract should not be a function
 * of which formatter version the developer happens to have — and
 * `protocol-schema/` is excluded in `biome.json` for the same reason.
 *
 * `require()`-ing this file has no side effect: the specs compare the committed
 * files with `renderSchema()` / `renderSamples()`, and a require that rewrote
 * them first would make that comparison always pass.
 */
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join, relative } = require('node:path');

const { toProtocolJsonSchema } = require('../dist/protocol/json-schema.js');
const { SAMPLES } = require('../dist/protocol/samples.js');

const outputPath = join(__dirname, '..', 'protocol-schema', 'protocol.schema.json');
const samplesPath = join(__dirname, '..', 'protocol-schema', 'samples.json');

const renderSchema = () => `${JSON.stringify(toProtocolJsonSchema(), null, 2)}\n`;
const renderSamples = () => `${JSON.stringify(SAMPLES, null, 2)}\n`;

if (require.main === module) {
  const outputs = [
    [outputPath, renderSchema()],
    [samplesPath, renderSamples()],
  ];
  if (process.argv.includes('--check')) {
    const stale = outputs.filter(([path, output]) => readFileSync(path, 'utf8') !== output);
    for (const [path] of stale) {
      console.error(
        `${relative(process.cwd(), path)} is stale; run pnpm --filter @oppenheimer/shared build`,
      );
    }
    process.exit(stale.length === 0 ? 0 : 1);
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  for (const [path, output] of outputs) writeFileSync(path, output, 'utf8');
  console.log(
    `protocol JSON Schema and samples written to ${relative(process.cwd(), dirname(outputPath))}`,
  );
}

module.exports = { renderSchema, renderSamples, outputPath, samplesPath };
