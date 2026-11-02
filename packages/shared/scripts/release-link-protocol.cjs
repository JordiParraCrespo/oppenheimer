#!/usr/bin/env node
/**
 * Freeze the link protocol as released: copy
 * `protocol-schema/protocol.schema.json` to `protocol-schema/released.schema.json`.
 *
 * The released copy is what `src/protocol/__tests__/released-protocol.spec.ts`
 * holds every later schema to (`src/protocol/compatibility.ts` has the rules):
 * the link only grows, and a break is a `PROTOCOL_VERSION` bump on purpose.
 * Run it when a runner release is cut (`pnpm --filter @oppenheimer/shared
 * protocol:release`, which builds first so the artifact is fresh), and commit
 * the result with the release. Running it to make a red spec green is the one
 * thing it is not for: that ships the break to every runner already out there.
 *
 * Like every emitter here, it writes only when run, never on `require()`.
 */
const { copyFileSync } = require('node:fs');
const { join, relative } = require('node:path');

const schemaPath = join(__dirname, '..', 'protocol-schema', 'protocol.schema.json');
const releasedPath = join(__dirname, '..', 'protocol-schema', 'released.schema.json');

if (require.main === module) {
  copyFileSync(schemaPath, releasedPath);
  console.log(`released link protocol frozen at ${relative(process.cwd(), releasedPath)}`);
}

module.exports = { schemaPath, releasedPath };
