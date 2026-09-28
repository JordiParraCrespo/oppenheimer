import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AdminController } from '../../admin/admin.controller';
import {
  InvitationsController,
  OrganizationInvitationsController,
} from '../../organizations/invitations.controller';
import { MembersController } from '../../organizations/members.controller';
import { OrganizationsController } from '../../organizations/organizations.controller';
import { WorkspacesController } from '../../organizations/workspaces.controller';
import { ChangeEmailHttpController } from '../../profile/commands/change-email/change-email.http.controller';
import { ChangePasswordHttpController } from '../../profile/commands/change-password/change-password.http.controller';
import { RevokeOtherSessionsHttpController } from '../../profile/commands/revoke-other-sessions/revoke-other-sessions.http.controller';
import { RevokeSessionHttpController } from '../../profile/commands/revoke-session/revoke-session.http.controller';
import { USES_BETTER_AUTH_SESSION_KEY } from '../decorators/uses-better-auth-session.decorator';

/**
 * A scoped credential only gets a delegated Better Auth session on a route
 * marked `@UsesBetterAuthSession()`. A façade that calls `auth.api.*` without
 * the mark answers an API token as if nobody were signed in — silently, since
 * nothing else in the build would notice. These two checks are that notice.
 */

const SRC = resolve(__dirname, '../..');

/**
 * Every file that calls Better Auth's server API, and why that is fine. A new
 * file fails the scan below until it is listed here with the controllers that
 * reach it — and those controllers are then held to the mark.
 */
const CALLERS: Record<string, readonly (abstract new (...args: never[]) => unknown)[]> = {
  'admin/admin.service.ts': [AdminController],
  'organizations/organizations.service.ts': [OrganizationsController, MembersController],
  'organizations/invitations.service.ts': [
    OrganizationInvitationsController,
    InvitationsController,
  ],
  'organizations/workspaces.service.ts': [WorkspacesController],
  'profile/infrastructure/profile-auth.gateway.ts': [
    ChangePasswordHttpController,
    RevokeSessionHttpController,
    RevokeOtherSessionsHttpController,
    ChangeEmailHttpController,
  ],
  // Not façades. The verifier *is* how a request's session is resolved, and
  // the seed is a script with no request at all.
  'auth/infrastructure/better-auth-credential-verifier.adapter.ts': [],
  'database/seed.ts': [],
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

/** Whether a file calls `auth.api.*`, ignoring comments that only mention it. */
function callsBetterAuth(source: string): boolean {
  return (
    source
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n')
      .match(/\bauth\.api\s*\.\s*[A-Za-z]/) !== null
  );
}

describe('delegated session coverage', () => {
  it('knows every file that calls Better Auth as the caller', () => {
    const callers = sourceFiles(SRC)
      .filter((path) => callsBetterAuth(readFileSync(path, 'utf8')))
      .map((path) => relative(SRC, path))
      .sort();

    expect(callers).toEqual(Object.keys(CALLERS).sort());
  });

  it.each(
    Object.entries(CALLERS).flatMap(([file, controllers]) =>
      controllers.map((controller) => [controller.name, file, controller] as const),
    ),
  )('%s (reaching %s) is marked @UsesBetterAuthSession()', (_name, _file, controller) => {
    expect(new Reflector().get(USES_BETTER_AUTH_SESSION_KEY, controller)).toBe(true);
  });
});
