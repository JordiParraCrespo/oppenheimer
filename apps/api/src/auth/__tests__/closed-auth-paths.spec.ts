/**
 * Better Auth's organization plugin writes the roster, invitations and teams
 * without the application role that goes with them, so every one of its write
 * routes is closed to HTTP (`CLOSED_ORGANIZATION_PATHS`) unless it is named
 * here as writing only the session's own selection or answering a question.
 * The list is checked against the plugin's own endpoints, so a Better Auth
 * release that adds a write route fails this until someone decides which side
 * it is on. `auth.integration.spec.ts` checks the closed paths answer 404.
 */
import { organizationSharedOptions } from '@oppenheimer/auth';
import { organization } from 'better-auth/plugins';
import { describe, expect, it } from 'vitest';
import { CLOSED_ORGANIZATION_PATHS } from '../infrastructure/closed-auth-paths.util';

/** Non-GET routes left open: they write only the session's selection, or only read. */
const OPEN_WRITES = [
  '/organization/set-active',
  '/organization/set-active-team',
  '/organization/check-slug',
  '/organization/has-permission',
];

/** Every route the plugin mounts that is not a GET, as the API configures it. */
function pluginWriteRoutes(): string[] {
  const plugin = organization({ teams: organizationSharedOptions.teams });
  return Object.values(plugin.endpoints)
    .filter((endpoint) => endpoint.path)
    .filter((endpoint) => [endpoint.options.method].flat().some((method) => method !== 'GET'))
    .map((endpoint) => endpoint.path);
}

describe('CLOSED_ORGANIZATION_PATHS', () => {
  it('closes every organization write route Better Auth mounts, but the open ones named here', () => {
    const writes = pluginWriteRoutes();
    expect(writes.length).toBeGreaterThan(0);

    const undecided = writes.filter(
      (path) =>
        !(CLOSED_ORGANIZATION_PATHS as readonly string[]).includes(path) &&
        !OPEN_WRITES.includes(path),
    );
    expect(undecided).toEqual([]);
  });

  it('names only routes the plugin mounts, so a removed one is noticed', () => {
    const writes = pluginWriteRoutes();
    expect(
      [...CLOSED_ORGANIZATION_PATHS, ...OPEN_WRITES].filter((p) => !writes.includes(p)),
    ).toEqual([]);
  });
});
