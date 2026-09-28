import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { BanUserHttpController } from '../../admin/commands/ban-user/ban-user.http.controller';
import { CreateUserHttpController } from '../../admin/commands/create-user/create-user.http.controller';
import { ImpersonateUserHttpController } from '../../admin/commands/impersonate-user/impersonate-user.http.controller';
import { RemoveUserHttpController } from '../../admin/commands/remove-user/remove-user.http.controller';
import { RevokeUserSessionHttpController } from '../../admin/commands/revoke-user-session/revoke-user-session.http.controller';
import { RevokeUserSessionsHttpController } from '../../admin/commands/revoke-user-sessions/revoke-user-sessions.http.controller';
import { SetUserPasswordHttpController } from '../../admin/commands/set-user-password/set-user-password.http.controller';
import { SetUserRoleHttpController } from '../../admin/commands/set-user-role/set-user-role.http.controller';
import { StopImpersonatingHttpController } from '../../admin/commands/stop-impersonating/stop-impersonating.http.controller';
import { UnbanUserHttpController } from '../../admin/commands/unban-user/unban-user.http.controller';
import { UpdateUserHttpController } from '../../admin/commands/update-user/update-user.http.controller';
import { GetUserHttpController } from '../../admin/queries/get-user/get-user.http.controller';
import { ListUserSessionsHttpController } from '../../admin/queries/list-user-sessions/list-user-sessions.http.controller';
import { ListUsersHttpController } from '../../admin/queries/list-users/list-users.http.controller';
import { AcceptInvitationHttpController } from '../../organizations/commands/accept-invitation/accept-invitation.http.controller';
import { AddMemberHttpController } from '../../organizations/commands/add-member/add-member.http.controller';
import { AddWorkspaceMemberHttpController } from '../../organizations/commands/add-workspace-member/add-workspace-member.http.controller';
import { CancelInvitationHttpController } from '../../organizations/commands/cancel-invitation/cancel-invitation.http.controller';
import { CreateOrganizationHttpController } from '../../organizations/commands/create-organization/create-organization.http.controller';
import { CreateWorkspaceHttpController } from '../../organizations/commands/create-workspace/create-workspace.http.controller';
import { DeleteOrganizationHttpController } from '../../organizations/commands/delete-organization/delete-organization.http.controller';
import { DeleteWorkspaceHttpController } from '../../organizations/commands/delete-workspace/delete-workspace.http.controller';
import { InviteMemberHttpController } from '../../organizations/commands/invite-member/invite-member.http.controller';
import { LeaveOrganizationHttpController } from '../../organizations/commands/leave-organization/leave-organization.http.controller';
import { RejectInvitationHttpController } from '../../organizations/commands/reject-invitation/reject-invitation.http.controller';
import { RemoveMemberHttpController } from '../../organizations/commands/remove-member/remove-member.http.controller';
import { RemoveWorkspaceMemberHttpController } from '../../organizations/commands/remove-workspace-member/remove-workspace-member.http.controller';
import { RenameWorkspaceHttpController } from '../../organizations/commands/rename-workspace/rename-workspace.http.controller';
import { SetActiveOrganizationHttpController } from '../../organizations/commands/set-active-organization/set-active-organization.http.controller';
import { SetActiveWorkspaceHttpController } from '../../organizations/commands/set-active-workspace/set-active-workspace.http.controller';
import { UpdateMemberRoleHttpController } from '../../organizations/commands/update-member-role/update-member-role.http.controller';
import { UpdateOrganizationHttpController } from '../../organizations/commands/update-organization/update-organization.http.controller';
import { CheckOrganizationSlugHttpController } from '../../organizations/queries/check-organization-slug/check-organization-slug.http.controller';
import { GetInvitationHttpController } from '../../organizations/queries/get-invitation/get-invitation.http.controller';
import { GetOrganizationHttpController } from '../../organizations/queries/get-organization/get-organization.http.controller';
import { ListMembersHttpController } from '../../organizations/queries/list-members/list-members.http.controller';
import { ListMyInvitationsHttpController } from '../../organizations/queries/list-my-invitations/list-my-invitations.http.controller';
import { ListMyWorkspacesHttpController } from '../../organizations/queries/list-my-workspaces/list-my-workspaces.http.controller';
import { ListOrganizationInvitationsHttpController } from '../../organizations/queries/list-organization-invitations/list-organization-invitations.http.controller';
import { ListOrganizationsHttpController } from '../../organizations/queries/list-organizations/list-organizations.http.controller';
import { ListWorkspaceMembersHttpController } from '../../organizations/queries/list-workspace-members/list-workspace-members.http.controller';
import { ListWorkspacesHttpController } from '../../organizations/queries/list-workspaces/list-workspaces.http.controller';
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
  'admin/infrastructure/admin-auth.gateway.ts': [
    ListUsersHttpController,
    CreateUserHttpController,
    StopImpersonatingHttpController,
    RevokeUserSessionHttpController,
    GetUserHttpController,
    UpdateUserHttpController,
    RemoveUserHttpController,
    SetUserRoleHttpController,
    BanUserHttpController,
    UnbanUserHttpController,
    ImpersonateUserHttpController,
    ListUserSessionsHttpController,
    RevokeUserSessionsHttpController,
    SetUserPasswordHttpController,
  ],
  'organizations/infrastructure/organization-auth.gateway.ts': [
    CreateOrganizationHttpController,
    ListOrganizationsHttpController,
    CheckOrganizationSlugHttpController,
    GetOrganizationHttpController,
    UpdateOrganizationHttpController,
    DeleteOrganizationHttpController,
    SetActiveOrganizationHttpController,
    ListMembersHttpController,
    AddMemberHttpController,
    UpdateMemberRoleHttpController,
    RemoveMemberHttpController,
    LeaveOrganizationHttpController,
    AcceptInvitationHttpController,
  ],
  'organizations/infrastructure/invitation-auth.gateway.ts': [
    InviteMemberHttpController,
    ListOrganizationInvitationsHttpController,
    ListMyInvitationsHttpController,
    GetInvitationHttpController,
    AcceptInvitationHttpController,
    RejectInvitationHttpController,
    CancelInvitationHttpController,
  ],
  'organizations/infrastructure/workspace-auth.gateway.ts': [
    CreateOrganizationHttpController,
    ListMyWorkspacesHttpController,
    ListWorkspacesHttpController,
    CreateWorkspaceHttpController,
    RenameWorkspaceHttpController,
    DeleteWorkspaceHttpController,
    SetActiveWorkspaceHttpController,
    ListWorkspaceMembersHttpController,
    AddWorkspaceMemberHttpController,
    RemoveWorkspaceMemberHttpController,
  ],
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
