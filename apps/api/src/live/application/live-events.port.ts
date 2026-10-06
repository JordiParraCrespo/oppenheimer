import type { LiveEvent } from '@oppenheimer/shared/live';

export type LiveEventListener = (event: LiveEvent) => void;

/**
 * Which row of a workspace changed, from whichever replica heard it to every
 * replica holding a console of that workspace. A domain event reaches one
 * replica (the outbox delivers it once); a console's stream lives on whichever
 * replica it dialled.
 */
export interface LiveEventsPort {
  /**
   * Tell every console of the workspace. Best effort: a console that misses
   * one reads its rows again when its stream is next dialled.
   */
  publish(organizationId: string, event: LiveEvent): Promise<void>;
  /**
   * Hear the workspace's events until the returned function is called.
   * Rejects when the bus cannot be reached, so a stream is refused rather than
   * opened deaf.
   */
  subscribe(organizationId: string, listener: LiveEventListener): Promise<() => void>;
}
