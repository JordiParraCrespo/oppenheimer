import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The API's own `package.json` version, read once at load. `src/health/…` and
 * `dist/health/…` sit at the same depth under `apps/api`, and the image copies
 * that `package.json` beside `dist`, so one relative path serves dev and prod.
 */
export const API_VERSION: string = (
  JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf8')) as { version: string }
).version;
