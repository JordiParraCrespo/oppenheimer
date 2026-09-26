/**
 * What deleting an account needs the runners told before the rows go: the
 * agents stopped and the machines let go of.
 *
 * Both are best-effort. A host that is offline, or a session that already
 * ended, does not keep anyone from deleting their account — the rows go
 * either way, and a runner whose host row is gone is refused on its next dial.
 */
export interface WorkspaceShutdownPort {
  /** Ask the host of every live session in these workspaces to stop it. */
  stopSessions(userId: string, workspaceIds: readonly string[]): Promise<void>;

  /** Unpair every host the person owns, which closes its link for good. */
  unpairHosts(userId: string): Promise<void>;
}
