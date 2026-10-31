import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatOpenApiJson } from '../openapi-json';

/**
 * `openapi.json` is written already in Biome's style, so the generator never
 * needs a format pass that a file over Biome's size limit would skip. What
 * breaks it: an array kept open (or folded) differently from Biome, which
 * shows as a diff in "Generated files unchanged" on every regeneration.
 */
describe('formatOpenApiJson', () => {
  it('writes the committed document byte for byte', () => {
    const committed = readFileSync(resolve(__dirname, '../../openapi.json'), 'utf8');
    expect(formatOpenApiJson(JSON.parse(committed))).toBe(committed);
  });

  it('keeps objects open, folds a short array of plain values, and opens one past the line', () => {
    const long = Array.from({ length: 12 }, (_, index) => `value-${index}`);
    expect(formatOpenApiJson({ tags: ['Bots'], auth: [{ bearer: [] }], long, none: {} })).toBe(
      [
        '{',
        '  "tags": ["Bots"],',
        '  "auth": [',
        '    {',
        '      "bearer": []',
        '    }',
        '  ],',
        '  "long": [',
        ...long.map((value, index) => `    "${value}"${index < long.length - 1 ? ',' : ''}`),
        '  ],',
        '  "none": {}',
        '}',
        '',
      ].join('\n'),
    );
  });
});
