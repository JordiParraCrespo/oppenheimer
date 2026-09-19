import type { AccessScope } from '@oppenheimer/backend-authz';

/**
 * What a project is still being used for, answered by whoever owns the thing that
 * uses it.
 *
 * Archiving a project has to refuse while work is still going on inside its
 * directory, and this module cannot answer that: sessions are somebody else's
 * aggregate. So the question is a port this module **declares** and another module
 * **implements**, which is the same shape the authorization kernel uses for
 * resources — the owner of the question and the owner of the answer meet at a
 * contract rather than at an import.
 *
 * Fail-closed is therefore a DI fact: with nothing registered there is no
 * implementation, and the archive refuses. That is not a fallback to be caught; it
 * is the absence of an answer on a destructive path.
 */
export interface ProjectUsagePort {
  /** Whether the project holds sessions the fold has not moved to `resolved`. */
  hasUnresolvedSessions(scope: AccessScope, projectId: string): Promise<boolean>;
}

/**
 * How the module that can answer hands its implementation in.
 *
 * It is a second port rather than an exported class because the dependency only
 * runs one way: `sessions/` imports this module — a session needs the project it
 * belongs to — so this module cannot import that one, and what crosses the seam is
 * a contract plus a token, never an internal.
 */
export interface ProjectUsageRegistrarPort {
  register(usage: ProjectUsagePort): void;
}
