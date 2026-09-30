/**
 * Application code injects each port through its token, so it depends on the
 * repository port or the Better Auth port, never on the adapter behind it.
 */
export const PERSONAL_WORKSPACE_REPOSITORY = Symbol('PERSONAL_WORKSPACE_REPOSITORY');
export const WORKSPACE_LOOKUP = Symbol('WORKSPACE_LOOKUP');
export const MEMBER_REPOSITORY = Symbol('MEMBER_REPOSITORY');
export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');

/** Access grants and session selection that outlive a membership. */
export const ORGANIZATION_ACCESS = Symbol('ORGANIZATION_ACCESS');

/** Better Auth's organization plugin: organizations and their members. */
export const ORGANIZATION_AUTH = Symbol('ORGANIZATION_AUTH');
/** Better Auth's organization plugin: invitations. */
export const INVITATION_AUTH = Symbol('INVITATION_AUTH');
/** Better Auth's organization plugin: teams, which the console calls workspaces. */
export const WORKSPACE_AUTH = Symbol('WORKSPACE_AUTH');
/** Better Auth's organization and team rows, read to answer with what was just written. */
export const ORGANIZATION_REPOSITORY = Symbol('ORGANIZATION_REPOSITORY');
