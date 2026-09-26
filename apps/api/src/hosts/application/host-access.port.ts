import type { AccessScope } from '@oppenheimer/backend-authz';

/**
 * Whether a caller may put work on a host.
 *
 * `hostId` on a session cannot be held by a composite foreign key the way a
 * project can: a host has no workspace column, and a *grant* is a row rather
 * than a column. So the reference is guarded here instead, by loading the host
 * through the own-or-grant-scoped repository and refusing on a miss — which is
 * the one reference in the schema that a check guards rather than a constraint,
 * and is named as such.
 */
export interface HostAccessPort {
  /**
   * Throws the hosts module's not-found problem unless `hostId` names a host the
   * caller can reach and that is still paired. Reports an unreachable host and a
   * missing one identically, so ids stay unprobeable.
   */
  assertUsable(scope: AccessScope, hostId: string): Promise<UsableHost>;
}

/** What a caller that may use a host learns about it. */
export interface UsableHost {
  /**
   * The tool names the runner's last inventory probed, found or not; null until
   * it has reported one. A runner probes the command of every agent it can
   * launch, so this is also what that runner can start.
   */
  probedTools: readonly string[] | null;
}
