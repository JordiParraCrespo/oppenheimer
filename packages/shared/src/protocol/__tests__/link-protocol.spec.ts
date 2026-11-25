import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

/**
 * The committed generations of the protocol: the samples the runner decodes,
 * and the Go structs it decodes them into. Each emitter is side-effect free on
 * `require()`, so these compare the committed file with a fresh render rather
 * than with a file the require just rewrote.
 *
 * The emitters load the compiled protocol (`dist/`) cold. That load is done
 * once, here, while the file is collected, not inside a test: on a loaded CI
 * machine it ran past the 5s a test is allowed, and failed `main` with a
 * timeout that said nothing about the protocol.
 */
const require = createRequire(import.meta.url);
const linkEmitter = require('../../../scripts/emit-link-protocol.cjs');
const schemaEmitter = require('../../../scripts/emit-protocol-schema.cjs');

describe('the runner link protocol', () => {
  it('is the committed generation of the schema artifact', () => {
    expect(readFileSync(linkEmitter.outputPath, 'utf8')).toBe(linkEmitter.render());
  });

  it('commits the samples the Go drift test decodes', () => {
    expect(readFileSync(schemaEmitter.samplesPath, 'utf8')).toBe(schemaEmitter.renderSamples());
  });

  it('refuses to guess the Go width of an integer it has no entry for', () => {
    const schema = readSchema();
    const branches = schema.anyOf as { properties: Record<string, unknown> }[];
    branches[0].properties.retries = { type: 'integer', minimum: 0 };
    expect(() => linkEmitter.render(schema)).toThrow(
      /no Go width for the integer at hello\.retries/,
    );
  });
});

function readSchema(): Record<string, unknown> {
  return JSON.parse(readFileSync(linkEmitter.schemaPath, 'utf8'));
}
