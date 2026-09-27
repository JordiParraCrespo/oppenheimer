/**
 * What is running on a host, answered by whoever owns the thing that runs.
 *
 * The Settings hosts list says "Running · 2 sessions" beside a machine, and the
 * remove dialog says what removing it stops. This module cannot count that:
 * sessions are somebody else's aggregate, and the dependency only runs one way —
 * a session needs the host it runs on, so `sessions/` imports this module and
 * never the reverse. So the question is a port this module **declares** and
 * another module **implements**, the shape `projects/` uses for the same reason
 * (`ProjectUsagePort`).
 *
 * The answer is a display count, not a gate, so an empty registry is not
 * fail-closed the way an archive's is: it reads as nothing running, which is
 * the truth for a deployment built without sessions.
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
