import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PERMISSION_GROUPS } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { type ScopeDeclaration, scanRoutes } from './route-scopes';
import inventory from './route-scopes.inventory.json';

/**
 * Every route, and what a scoped credential (an API token, an OAuth grant)
 * needs to call it: the scopes in `@RequireScopes`, `any` for
 * `@AllowAnyScope()`, or `session-only` for a route that declares neither and
 * so refuses every token (`TOKEN_006`).
 *
 * A route on the wrong scope hands a credential more reach than its holder
 * meant to grant, and is invisible in a diff: a decorator line changes, or a
 * new route arrives without one. So the whole map is written down in
 * `route-scopes.inventory.json` and checked against the source both ways; a
 * change to it is a change a reviewer sees. The textual scan is
 * `route-scopes.ts`, and it fails closed: a declaration it cannot read for
 * certain fails this spec instead of being counted as `session-only`.
 * `ScopesGuard`'s behaviour is its own spec.
 */

const { routes, unreadable } = scanRoutes();
const declared = Object.fromEntries(routes.map((route) => [route.route, route.scopes]));
const expected = inventory as Record<string, ScopeDeclaration>;
const catalog = new Set(
  PERMISSION_GROUPS.flatMap((group) => Object.values(group.levels).map((level) => level.scope)),
);

/**
 * Routes any credential may call, and why that exposes nothing a scope should
 * guard (`scopes-and-credentials.md`: the caller's own identity or work, or
 * what an anonymous caller already gets).
 */
const ANY_SCOPE: Record<string, string> = {
  'GET /v1/me/credential': 'describes the credential presenting it, and nothing else',
  'GET /v1/health/capabilities': 'served to anonymous callers; the login page reads it',
  'GET /v1/feature-flags': "the caller's own evaluated flags, which every client reads",
  'GET /v1/events': "the caller's own workspace change feed, filtered by what they may read",
  'DELETE /v1/hosts/self': "a host's own credential unpairing that host, and only it",
  'GET /v1/hosts/self/images/:commandId': 'a host fetching an image for its own command',
};

/**
 * Writes (by verb) that a read scope is enough for, and why they change
 * nothing the scope would protect.
 */
const WRITE_ON_READ: Record<string, string> = {
  'POST /v1/automations/trigger-preview': 'computes when a trigger would fire; stores nothing',
  'POST /v1/organizations/check-slug': 'asks whether a slug is free; a read with a body',
  'POST /v1/organizations/:id/set-active':
    "switches the caller's own session, not the organization",
  'POST /v1/workspaces/:id/set-active': "switches the caller's own session, not the workspace",
  'POST /v1/shared-sessions/lookup':
    'reads the session a share link names; a POST only so the secret stays out of the URL',
};

describe('route scope coverage', () => {
  it('finds the routes to check', () => {
    // A scan that silently matched nothing would pass every assertion below.
    expect(routes.length).toBeGreaterThan(150);
  });

  it('reads every route declaration for certain', () => {
    expect(unreadable).toEqual([]);
  });

  it('declares each route once', () => {
    const keys = routes.map((route) => route.route);
    expect(keys.filter((key, index) => keys.indexOf(key) !== index)).toEqual([]);
  });

  it('matches the committed inventory, route for route', () => {
    // Both directions: a new route needs an entry, a removed one loses it, and
    // a changed decorator changes the file a reviewer reads.
    expect(declared).toEqual(expected);
  });

  it('names only scopes the catalog defines', () => {
    const unknown = routes.flatMap((route) =>
      Array.isArray(route.scopes)
        ? route.scopes
            .filter((scope) => !catalog.has(scope))
            .map((scope) => `${route.route}: ${scope}`)
        : [],
    );
    expect(unknown).toEqual([]);
  });

  it('never both requires scopes and allows any scope on one route', () => {
    expect(routes.filter((route) => route.contradictory).map((route) => route.route)).toEqual([]);
  });

  it('allows any scope only where the ledger says why', () => {
    const open = routes.filter((route) => route.scopes === 'any').map((route) => route.route);
    expect(open.sort()).toEqual(Object.keys(ANY_SCOPE).sort());
  });

  it('asks a write scope of every write, unless the ledger says why not', () => {
    const readOnly = routes
      .filter(
        (route) =>
          !route.route.startsWith('GET ') &&
          Array.isArray(route.scopes) &&
          route.scopes.every((scope) => scope.endsWith(':read')),
      )
      .map((route) => route.route);
    expect(readOnly.sort()).toEqual(Object.keys(WRITE_ON_READ).sort());
  });

  it('never asks a write scope of a read', () => {
    const overAsked = routes
      .filter(
        (route) =>
          route.route.startsWith('GET ') &&
          Array.isArray(route.scopes) &&
          route.scopes.some((scope) => scope.endsWith(':write')),
      )
      .map((route) => route.route);
    expect(overAsked).toEqual([]);
  });
});

describe('the route scan', () => {
  /** Scan one fixture controller (and the files beside it) in a directory of its own. */
  function scan(files: Record<string, string>) {
    const directory = mkdtempSync(join(tmpdir(), 'route-scan-'));
    try {
      for (const [name, body] of Object.entries(files)) {
        mkdirSync(join(directory, name, '..'), { recursive: true });
        writeFileSync(join(directory, name), body);
      }
      return scanRoutes(directory);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  const controller = (body: string, prelude = "@Controller('things')") =>
    `${prelude}\nexport class ThingsHttpController {\n${body}\n}\n`;

  it('reads a decorator whose arguments span lines, and a class version', () => {
    const { routes, unreadable } = scan({
      'things.http.controller.ts': controller(
        [
          "  @Post(':id')",
          '  @RequireScopes(',
          "    'things:write',",
          "    'things:read',",
          '  )',
          "  // @Get('commented-out') is not a route",
          '  update() {}',
        ].join('\n'),
        "@Controller('things')\n@Version('2')",
      ),
    });

    expect(unreadable).toEqual([]);
    expect(routes.map((route) => [route.route, route.scopes])).toEqual([
      ['POST /v2/things/:id', ['things:write', 'things:read']],
    ]);
  });

  it.each([
    ['a template-literal path', `  @Get(\`\${PREFIX}/x\`)\n  find() {}`, 'is not literal'],
    [
      'a scope held in a constant',
      '  @Get()\n  @RequireScopes(SCOPE)\n  find() {}',
      'is not literal',
    ],
    ['a version held in a constant', '  @Get()\n  @Version(V)\n  find() {}', 'is not literal'],
    [
      'a route decorator it cannot pin to a method',
      '  @Get()\n  get thing() { return 1; }',
      'read on a method',
    ],
  ])('fails closed on %s instead of calling it session-only', (_case, body, reason) => {
    const { routes, unreadable } = scan({ 'things.http.controller.ts': controller(body) });

    expect(routes.filter((route) => route.scopes === 'session-only')).toEqual([]);
    expect(unreadable).toEqual([expect.stringContaining(reason)]);
  });

  it('fails closed on a second class in a controller file', () => {
    const { unreadable } = scan({
      'things.http.controller.ts': `${controller('  @Get()\n  find() {}')}export class Other {}\n`,
    });

    expect(unreadable).toEqual([expect.stringContaining('2 classes')]);
  });

  it('fails closed on a controller in a file it would not otherwise open', () => {
    const { unreadable } = scan({ 'things.ts': controller('  @Get()\n  find() {}') });

    expect(unreadable).toEqual([expect.stringContaining('outside a *.controller.ts file')]);
  });
});
