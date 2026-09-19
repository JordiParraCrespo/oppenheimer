#!/usr/bin/env node
/**
 * Write `protocol-schema/protocol.schema.json` from the Zod union.
 *
 * This runs as the second half of `pnpm --filter @oppenheimer/shared build`, not
 * as a script somebody has to remember: the artifact is what the Go structs are
 * generated from, so leaving it behind a separate command is how it goes stale
 * while `tsc` alone reports success.
 *
 * The output is plain, stable `JSON.stringify(…, null, 2)`. It is deliberately
 * not run through a formatter — the committed contract should not be a function
 * of which formatter version the developer happens to have — and
 * `protocol-schema/` is excluded in `biome.json` for the same reason.
 */
const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, join, relative } = require('node:path');

const { toProtocolJsonSchema } = require('../dist/protocol/json-schema.js');

const outputPath = join(__dirname, '..', 'protocol-schema', 'protocol.schema.json');

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(toProtocolJsonSchema(), null, 2)}\n`, 'utf8');

console.log(`protocol JSON Schema written to ${relative(process.cwd(), outputPath)}`);
