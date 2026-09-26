import type { HostStatus } from '@oppenheimer/shared';

/** The three facts a host's one-word status is read from. */
export interface HostStatusFacts {
  unpaired: boolean;
  online: boolean;
  runningSessions: number;
}

/**
 * `running`, `idle`, `offline` or `unpaired`. An unpaired host is only ever
 * unpaired, and an offline one is never "running" on the strength of sessions
 * it cannot hear from. Derived on every read and never stored, like `online`
 * itself.
 */
export function hostStatusOf(facts: HostStatusFacts): HostStatus {
  if (facts.unpaired) return 'unpaired';
  if (!facts.online) return 'offline';
  return facts.runningSessions > 0 ? 'running' : 'idle';
}
