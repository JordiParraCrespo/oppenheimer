/**
 * What asking a host's runner to update came back with: the request is on its
 * way, or there is no live link to send it down.
 */
export type HostUpdateOutcome = { kind: 'requested' } | { kind: 'host_offline' };

/**
 * What the module that owns the runner link implements so the console's
 * Update runner can send `host.update` (`product/versions/mvp/09-runner-install-and-update.md`
 * §5, "Manual control").
 *
 * It does not wait for an answer. A runner that installs a release restarts and
 * comes back with a new hello carrying its version, which is the only success
 * there is to report; one already current does nothing. Either way the runner
 * still verifies the signed manifest itself: this asks, it hands over nothing.
 */
export interface HostUpdatePort {
  /** Ask `hostId`'s runner for the newest release on `channel`, without pinning it. */
  request(hostId: string, channel: string): HostUpdateOutcome;
}
