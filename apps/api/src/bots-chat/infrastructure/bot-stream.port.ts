import type { BotStreamEvent, BotStreamSnapshot } from '@oppenheimer/shared';

/** What is published as it is: everything but a turn's text, which {@link BotStreamPort.write} places. */
export type BotStreamNudge = Exclude<BotStreamEvent, { type: 'text' | 'snapshot' }>;

/**
 * A bot's live channel: what a running turn writes, as it writes it, for the
 * chats open on it on any replica. Best-effort and never the record; the
 * stored messages are, and a chat reads them again when a turn ends.
 *
 * The block of text a turn is writing is also kept until it is stored, so a
 * chat that (re)connects mid-block reads it whole ({@link inFlight}) instead
 * of from the next delta on.
 */
export interface BotStreamPort {
  /** Never rejects: a turn does not fail because nobody could hear it. */
  publish(botId: string, event: BotStreamNudge): Promise<void>;
  /**
   * A delta of the turn's `block`th block: added to what is kept of it, and
   * published with its place (`block`, and the turn's next `seq`). Never
   * rejects.
   */
  write(botId: string, turnId: string, block: number, text: string): Promise<void>;
  /** The block being written ended: what was kept of it goes, its `seq` stays. Never rejects. */
  settle(botId: string, turnId: string): Promise<void>;
  /** The turn ended: nothing of it is kept. Never rejects. */
  forget(botId: string, turnId: string): Promise<void>;
  /** What each turn of the bot that writes has kept, as a `snapshot` frame; none when Redis cannot say. */
  inFlight(botId: string): Promise<BotStreamSnapshot[]>;
  /**
   * Resolves once the subscription is in place. `onLost` is called once if it
   * is dropped under the listener, so the stream ends and is dialled again.
   */
  subscribe(
    botId: string,
    listener: (event: BotStreamEvent) => void,
    onLost: () => void,
  ): Promise<() => void>;
}
