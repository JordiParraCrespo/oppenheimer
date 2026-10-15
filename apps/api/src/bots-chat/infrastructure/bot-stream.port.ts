import type { BotStreamEvent } from '@oppenheimer/shared';

/**
 * A bot's live channel: what a running turn writes, as it writes it, for the
 * chats open on it on any replica. Best-effort and never the record; the
 * stored messages are, and a chat reads them again when a turn ends.
 */
export interface BotStreamPort {
  /** Never rejects: a turn does not fail because nobody could hear it. */
  publish(botId: string, event: BotStreamEvent): Promise<void>;
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
