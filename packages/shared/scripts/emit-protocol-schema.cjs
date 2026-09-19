#!/usr/bin/env node
/**
 * Emit the runner link's JSON Schema from the Zod union.
 *
 * `pnpm --filter @oppenheimer/shared build:protocol` builds first and then runs
 * this, because the emitter is ordinary package code (`src/protocol/json-schema.ts`)
 * rather than a second description of the wire. The output is committed: the Go
 * structs in `packages/go/protocol` are generated from it (runner slice R2), so
 * a diff in this file is the reviewable record of a wire change.
 */
const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, join, relative } = require('node:path');

const { toProtocolJsonSchema } = require('../dist/protocol');

const outputPath = join(__dirname, '..', 'protocol-schema', 'protocol.schema.json');

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(toProtocolJsonSchema(), null, 2)}\n`, 'utf8');

console.log(`protocol JSON Schema written to ${relative(process.cwd(), outputPath)}`);
