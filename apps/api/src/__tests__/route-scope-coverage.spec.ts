import { PERMISSION_GROUPS } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { declaredRoutes, type ScopeDeclaration } from './route-scopes';
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
 * `route-scopes.ts`; `ScopesGuard`'s behaviour is its own spec.
 */

const routes = declaredRoutes();
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
};

describe('route scope coverage', () => {
  it('finds the routes to check', () => {
    // A scan that silently matched nothing would pass every assertion below.
    expect(routes.length).toBeGreaterThan(150);
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
