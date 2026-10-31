/**
 * What the relay calls with a runner's hello: the sessions the host holds, so
 * the control plane can reconcile against its own rows rather than replay a
 * queue (01, "Hello, heartbeat and hints").
 */
export interface HostReconciliationOutcome {
  /** Sessions owed a launch that the host did not report: dispatched again. */
  redispatched: string[];
  /** Sessions the rows call open that the host no longer holds: recorded stopped. */
  stopped: string[];
  /** Sessions with a close still owed: sent the close again. */
  reclosed: string[];
}

export interface SessionReconciliationPort {
  reconcile(
    hostId: string,
    /** The runner's process id, which with the epoch keys the entries this writes. */
    runId: string,
    /** The link's epoch: one reconciliation per link, however often it is retried. */
    epoch: number,
    heldSessionIds: readonly string[],
  ): Promise<HostReconciliationOutcome>;
}
