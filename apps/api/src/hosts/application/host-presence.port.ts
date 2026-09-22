import type { HostFactsDto } from '@oppenheimer/shared';

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
   * Record a hello or a heartbeat: the facts are the same shape registration
   * validated (`hostFactsSchema`), so the two describe one machine, and `at` is
   * when this process received the report — never the runner's clock, which a
   * skewed host would use to take itself offline. An unknown or unpaired host is
   * ignored rather than resurrected.
   */
  observe(hostId: string, facts: HostFactsDto, at?: Date): Promise<void>;
}
