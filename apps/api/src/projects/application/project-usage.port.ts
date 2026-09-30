import type { AccessScope } from '@oppenheimer/backend-authz';

/**
 * What a project is still being used for, answered by whoever owns the thing that uses
 * it. Archiving must refuse while unclosed sessions are listed in it, and sessions are
 * another module's aggregate, so this module declares the port and that module
 * implements it (the shape the authorization kernel uses for resources).
 *
 * Fail-closed is a DI fact: with nothing contributed the registry is empty and the
 * archive refuses. That is not a fallback to catch; it is the absence of an answer on
 * a destructive path.
 */
export interface ProjectUsagePort {
  /** Whether the project holds sessions the fold has not moved to `resolved`. */
  hasUnresolvedSessions(scope: AccessScope, projectId: string): Promise<boolean>;
}
