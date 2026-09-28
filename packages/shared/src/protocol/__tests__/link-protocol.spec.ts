import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

/**
 * The committed generations of the protocol: the samples the runner decodes,
 * and the Go structs it decodes them into. Each emitter is side-effect free on
 * `require()`, so these compare the committed file with a fresh render rather
 * than with a file the require just rewrote.
 */
const require = createRequire(import.meta.url);

describe('the runner link protocol', () => {
  it('is the committed generation of the schema artifact', () => {
    const { outputPath, render } = require('../../../scripts/emit-link-protocol.cjs');
    expect(readFileSync(outputPath, 'utf8')).toBe(render());
  });

  it('commits the samples the Go drift test decodes', () => {
    const { renderSamples, samplesPath } = require('../../../scripts/emit-protocol-schema.cjs');
    expect(readFileSync(samplesPath, 'utf8')).toBe(renderSamples());
  });

  it('refuses to guess the Go width of an integer it has no entry for', () => {
    const { render } = require('../../../scripts/emit-link-protocol.cjs');
    const schema = readSchema();
    const branches = schema.anyOf as { properties: Record<string, unknown> }[];
    branches[0].properties.retries = { type: 'integer', minimum: 0 };
    expect(() => render(schema)).toThrow(/no Go width for the integer at hello\.retries/);
  });
});

function readSchema(): Record<string, unknown> {
  const { schemaPath } = require('../../../scripts/emit-link-protocol.cjs');
  return JSON.parse(readFileSync(schemaPath, 'utf8'));
}
