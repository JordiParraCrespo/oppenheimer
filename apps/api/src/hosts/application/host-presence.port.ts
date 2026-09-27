import type { HostFactsDto } from '@oppenheimer/shared';

/** What a hello or a heartbeat says about the machine, as the link received it. */
export interface PresenceReport {
  /** The facts, re-read: the same shape registration validated. */
  facts: HostFactsDto;
  /** The update channel; the heartbeat carries it, the hello does not. */
  channel?: string;
  loadAverage?: number;
  memoryAvailableBytes?: number;
  /** The link's last ping/pong, measured by the process holding it. */
  roundTripMillis?: number | null;
  /** Set on hello: when this link opened. */
  connectedAt?: Date;
}

/**
 * What the module that owns the runner link calls when a machine reports in.
 *
 * `online` is never stored: the repository derives it from `lastSeenAt` on every
 * read, so "this host is online" is exactly "this port was called within the
 * window", and a relay that dies takes every host it held offline with it,
 * without a writer having to notice.
 */
export interface HostPresencePort {
  /**
   * Record a hello or a heartbeat. The live numbers go to `host_presence`, one
   * narrow row; the static facts go to `host_inventory` only when they changed,
   * with the change on the host's timeline. `at` is when this process received
   * the report — never the runner's clock, which a skewed host would use to
   * take itself offline. An unknown or unpaired host is ignored rather than
   * resurrected, and reported as `false` so the caller can close the link it
   * arrived on.
   */
  observe(hostId: string, report: PresenceReport, at?: Date): Promise<boolean>;

  /**
   * Record the public address a link came from, as this process saw it —
   * never an address the runner reports. It becomes the host's current
   * network, placed with the deployment's IP database when there is one, and
   * a move to another country or network operator mails the owner. An unknown
   * or unpaired host is ignored.
   */
  connectedFrom(hostId: string, address: string, at?: Date): Promise<void>;
}
