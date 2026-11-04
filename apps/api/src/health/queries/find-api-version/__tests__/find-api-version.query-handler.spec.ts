/**
 * The API answers its own release, found by package name rather than by
 * directory depth: from anywhere under `apps/api` the lookup reads
 * `@oppenheimer/api`'s version, and with no such package above it the API
 * fails rather than answering another package's version.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import apiPackage from '../../../../../package.json';
import { readApiVersion } from '../../../infrastructure/api-version.util';
import { FindApiVersionQueryHandler } from '../find-api-version.query-handler';

describe('the API version', () => {
  it('answers the version of the @oppenheimer/api package', async () => {
    await expect(new FindApiVersionQueryHandler().execute()).resolves.toEqual({
      version: apiPackage.version,
    });
  });

  it('skips a nearer package.json of another name, and throws when none is the API', () => {
    const outside = mkdtempSync(join(tmpdir(), 'api-version-'));
    writeFileSync(
      join(outside, 'package.json'),
      JSON.stringify({ name: 'other', version: '9.9.9' }),
    );

    expect(() => readApiVersion(outside)).toThrow(/@oppenheimer\/api/);
  });
});
