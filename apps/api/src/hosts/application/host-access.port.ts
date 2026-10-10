import type { AccessScope } from '@oppenheimer/backend-authz';

/**
 * Whether a caller may put work on a host.
 *
 * `hostId` on a session has a plain foreign key, not a composite one the way a
 * project's does: a host has no workspace column, and a *grant* is a row rather
 * than a column. So whether the caller may use the host is guarded here, by
 * loading it through the own-or-grant-scoped repository and refusing on a miss.
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
  /**
   * How many sessions may run on it at once (`HostEntity.sessionLimit`); null
   * for a host that has not reported its size and has no limit set.
   */
  sessionLimit: number | null;
}
