import type { LiveEvent } from '@oppenheimer/shared/live';

/** One console's ear on a workspace: its events, and the bus going away under it. */
export interface LiveEventListener {
  event(event: LiveEvent): void;
  /** The bus dropped the workspace's channel; nothing more will be heard. */
  lost(): void;
}

/**
 * Which row of a workspace changed, from whichever replica heard it to every
 * replica holding a console of that workspace. A domain event reaches one
 * replica (the outbox delivers it once); a console's stream lives on whichever
 * replica it dialled.
 */
export interface LiveEventsPort {
  /**
   * Tell every console of the workspace. Best effort, and never rejects: a
   * console that misses one reads its rows again when its stream is next
   * dialled, and a domain event handler that threw would fail the outbox
   * delivery to every other listener of the event.
   */
  publish(organizationId: string, event: LiveEvent): Promise<void>;
  /**
   * Hear the workspace's events until the returned function is called, or
   * until `lost`. Rejects when the bus cannot be reached, so a stream is
   * refused rather than opened deaf.
   */
  subscribe(organizationId: string, listener: LiveEventListener): Promise<() => void>;
}
