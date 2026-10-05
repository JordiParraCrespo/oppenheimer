/**
 * What is running on a host, answered by whoever owns the thing that runs: the
 * Settings list's "Running · 2 sessions" and what the remove dialog says it stops.
 * `sessions/` imports this module and never the reverse, so this module **declares**
 * the port and another **implements** it, as `projects/` does with `ProjectUsagePort`.
 *
 * A display count, not a gate: an empty registry reads as nothing running, the truth
 * for a deployment without sessions, rather than failing closed as an archive does.
 */
export interface HostUsagePort {
  /**
   * How many sessions on each host have their agent up right now: not
   * resolved, and not stopped. The hosts were already read under the caller's
   * scope, so the count is of the machine, whoever's workspace started them —
   * a host is one person's and so is everything on it.
   *
   * A host with nothing running may be absent from the map.
   */
  countRunningSessions(hostIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
}
