import type { PortListingMessage } from '@oppenheimer/shared/protocol';

/** One port a session's processes listen on, as its runner listed it. */
export type SessionPort = PortListingMessage['ports'][number];

/**
 * What asking a session's host for its ports came back with: the ports, the
 * reason nothing was asked (no link, or a runner that does not forward
 * ports), no answer in time, or the runner's refusal with its catalog code
 * (`PORT_003` the host cannot tell).
 */
export type SessionPortsOutcome =
  | { kind: 'listed'; ports: SessionPort[] }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; code: string; detail?: string };

/**
 * What the module that owns the runner link implements so the Browser tab can
 * list the ports a session listens on
 * (`product/versions/mvp/30-session-previews.md`). Like `HostFoldersPort` it
 * waits for the runner's answer, and nothing is cached.
 */
export interface SessionPortsPort {
  list(hostId: string, sessionId: string): Promise<SessionPortsOutcome>;
}
