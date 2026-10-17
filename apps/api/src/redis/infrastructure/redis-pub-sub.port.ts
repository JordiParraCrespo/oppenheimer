/**
 * Redis pub/sub for the live streams (the workspace stream, a bot's chat):
 * JSON payloads on named channels, every channel of this replica on one
 * subscriber connection. What a channel is called, and what a payload must
 * look like to be passed on, is each stream's own.
 */
export interface RedisPubSubPort {
  /** Publishes `payload` as JSON. Rejects when Redis refuses it. */
  publish(channel: string, payload: unknown): Promise<void>;
  /**
   * Listens on `channels`, and resolves once every one of them is subscribed.
   * `listener` hears each message that parses as JSON, parsed, and nothing
   * else. `onLost` is called once if the connection goes under the
   * subscription, which then hears nothing more: what was published while it
   * was down never arrives, so the caller reads again and subscribes afresh.
   * Answers the call that ends the subscription.
   */
  subscribe(
    channels: readonly string[],
    listener: (payload: unknown) => void,
    onLost: () => void,
  ): Promise<() => void>;
}
