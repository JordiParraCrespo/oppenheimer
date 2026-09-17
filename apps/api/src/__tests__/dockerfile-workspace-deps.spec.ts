import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The API image installs dependencies from a hand-listed set of workspace
 * `package.json` files, so pnpm can resolve the lockfile before the sources are
 * copied. That list drifts: adding a workspace package the API depends on and
 * forgetting this line fails the Docker build in CI, well after the change that
 * caused it.
 *
 * This asserts the list covers every workspace package `@oppenheimer/api` depends on,
 * transitively — turning the drift into a unit-test failure.
 */

const REPO_ROOT = resolve(__dirname, '../../../..');
const DOCKERFILE = resolve(__dirname, '../../Dockerfile');

interface PackageManifest {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/** Every workspace package, keyed by name, with its path relative to the root. */
function workspacePackages(): Map<string, { path: string; manifest: PackageManifest }> {
  const roots = [
    'packages',
    'packages/backend',
    'packages/frontend/design-system',
    'packages/frontend',
    'apps',
  ];
  const found = new Map<string, { path: string; manifest: PackageManifest }>();

  for (const root of roots) {
    const absoluteRoot = join(REPO_ROOT, root);
    if (!existsSync(absoluteRoot)) continue;

    for (const entry of readdirSync(absoluteRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(absoluteRoot, entry.name, 'package.json');
      if (!existsSync(manifestPath)) continue;

      const manifest: PackageManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      found.set(manifest.name, { path: `${root}/${entry.name}`, manifest });
    }
  }

  return found;
}

/** Workspace packages `@oppenheimer/api` needs, following workspace deps transitively. */
function requiredWorkspacePackages(): Set<string> {
  const all = workspacePackages();
  const required = new Set<string>();
  const queue = ['@oppenheimer/api'];

  while (queue.length > 0) {
    const name = queue.pop();
    if (!name) continue;
    const entry = all.get(name);
    if (!entry) continue;

    // Both dependency kinds matter: a workspace devDependency (e.g. the shared
    // tsconfig) still has to be present for the build stage to run.
    const dependencies = {
      ...entry.manifest.dependencies,
      ...entry.manifest.devDependencies,
    };

    for (const [dependency, version] of Object.entries(dependencies)) {
      if (!version.startsWith('workspace:')) continue;
      if (required.has(dependency) || dependency === '@oppenheimer/api') continue;
      required.add(dependency);
      queue.push(dependency);
    }
  }

  return required;
}

describe('the API Dockerfile', () => {
  const dockerfile = readFileSync(DOCKERFILE, 'utf8');
  const all = workspacePackages();
  const required = requiredWorkspacePackages();

  it('finds the workspace packages to check', () => {
    // A resolution failure here would make every assertion below vacuous.
    expect(required.size).toBeGreaterThan(5);
    expect(required).toContain('@oppenheimer/shared');
  });

  it('copies the manifest of every workspace package the API depends on', () => {
    const missing = [...required]
      .map((name) => ({ name, path: all.get(name)?.path }))
      .filter((entry) => entry.path && !dockerfile.includes(`${entry.path}/package.json`))
      .map((entry) => `${entry.name} (${entry.path}/package.json)`);

    expect(missing).toEqual([]);
  });
});
