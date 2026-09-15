import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every HTTP route must state its authorization intent: either the capability
 * it requires (`@CheckPolicies`) or an explicit, reasoned exemption
 * (`@NoPolicy`).
 *
 * `PoliciesGuard` fails closed on a route that declares neither, so this test
 * is what turns that runtime rejection into a build failure — you find out when
 * you add the route, not when someone calls it.
 *
 * This is a source scan rather than a runtime `DiscoveryService` walk because
 * booting the application needs a database, Redis and a populated `.env`. The
 * trade is that it reads decorators textually; the integration suite covers
 * the runtime behaviour.
 */

const SRC = resolve(__dirname, '..');
const HTTP_METHOD = /^\s*@(Get|Post|Patch|Put|Delete|Head|Options|All)\(/;
const METHOD_SIGNATURE =
  /^\s{2}(?:public\s+|private\s+|protected\s+)?(?:async\s+)?[A-Za-z_]\w*\s*\(/;
const CLASS_DECLARATION = /^export class /;

interface Route {
  file: string;
  decorator: string;
  method: string;
  declaresPolicy: boolean;
  reason?: string;
}

function collectRoutes(file: string): Route[] {
  const lines = readFileSync(file, 'utf8').split('\n');
  const classAt = lines.findIndex((line) => CLASS_DECLARATION.test(line));
  const classPrelude = lines.slice(0, classAt === -1 ? lines.length : classAt).join('\n');
  // A class-level @CheckPolicies covers every route on the controller.
  const classDeclaresPolicy = classPrelude.includes('@CheckPolicies');

  const routes: Route[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!HTTP_METHOD.test(lines[index])) {
      index += 1;
      continue;
    }

    // Everything from the HTTP decorator to the method signature is this
    // route's decorator block.
    const start = index;
    let cursor = index;
    while (cursor < lines.length && !METHOD_SIGNATURE.test(lines[cursor])) cursor += 1;

    const block = lines.slice(start, cursor).join('\n');
    // Accept either quote style: the formatter normalizes some of these.
    const reason = /@NoPolicy\(\s*["'`]([^"'`]*)["'`]/.exec(block)?.[1];

    routes.push({
      file: relative(SRC, file),
      decorator: lines[start].trim(),
      method: (lines[cursor] ?? '').trim().slice(0, 60),
      declaresPolicy: classDeclaresPolicy || block.includes('@CheckPolicies'),
      reason,
    });

    index = cursor + 1;
  }

  return routes;
}

/** Every controller source under `src/`, excluding test folders. */
function controllerFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : controllerFiles(path);
    }
    return entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

const routes = controllerFiles(SRC).flatMap(collectRoutes);

describe('route policy coverage', () => {
  it('finds the controllers to check', () => {
    // A scan that silently matches nothing would pass every assertion below.
    expect(routes.length).toBeGreaterThan(50);
  });

  it('declares an authorization policy or a reasoned exemption on every route', () => {
    const undeclared = routes
      .filter((route) => !route.declaresPolicy && route.reason === undefined)
      .map((route) => `${route.file} ${route.decorator} -> ${route.method}`);

    expect(undeclared).toEqual([]);
  });

  it('never both requires and waives a policy on the same route', () => {
    const contradictory = routes
      .filter((route) => route.declaresPolicy && route.reason !== undefined)
      .map((route) => `${route.file} ${route.decorator}`);

    expect(contradictory).toEqual([]);
  });

  it('gives every exemption a non-trivial reason', () => {
    // The reason is the review artifact. An empty or placeholder string turns
    // the decorator back into the silent default it replaced.
    const weak = routes
      .filter((route) => route.reason !== undefined && route.reason.trim().length < 15)
      .map((route) => `${route.file} ${route.decorator} -> "${route.reason}"`);

    expect(weak).toEqual([]);
  });
});
