import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const PACKAGE_NAME = '@oppenheimer/api';

/**
 * The API's own `package.json` version: the nearest `package.json` above this
 * module that names `@oppenheimer/api`. Found by name rather than by depth, so
 * the same lookup holds from `src/` and `dist/`, and a move of this file or a
 * change in the build layout cannot read another package's version; with no
 * such file above it, the API fails at boot instead of answering a wrong one.
 */
export function readApiVersion(from: string = __dirname): string {
  for (let dir = from; ; dir = dirname(dir)) {
    const manifest = readManifest(join(dir, 'package.json'));
    if (manifest?.name === PACKAGE_NAME && typeof manifest.version === 'string') {
      return manifest.version;
    }
    if (dirname(dir) === dir) {
      throw new Error(`No package.json named ${PACKAGE_NAME} above ${from}`);
    }
  }
}

function readManifest(path: string): { name?: unknown; version?: unknown } | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}
