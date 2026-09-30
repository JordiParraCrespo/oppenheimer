/**
 * Whether a host assertion's `jti` was burned **before** the cache moved its
 * keys under `cache:` (#162), when the marker was written unprefixed as
 * `host-assertion:jti:<hostId>:<jti>`.
 *
 * TODO(remove after #162 has been live once): a marker lives at most the
 * boot token's five minutes plus 30 s of skew, so every unprefixed one has
 * expired by the release after the one that ships the prefix. Delete this
 * port, its adapter, the `LEGACY_REPLAY_MARKER` binding and the check in
 * `HostAssertionResolver.burn` then.
 */
export interface LegacyReplayMarkerPort {
  isBurned(hostId: string, jti: string): Promise<boolean>;
}
