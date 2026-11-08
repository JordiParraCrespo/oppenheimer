/** Whether a host can be asked anything about its Telegram bot now. */
export type TelegramDeviceReach = 'online' | 'offline' | 'unsupported';

/** What a send came to on the host. */
export type TelegramSendOutcome =
  | { kind: 'sent'; id: string; sentAt: Date }
  | { kind: 'host_offline' }
  | { kind: 'not_supported' }
  | { kind: 'timed_out' }
  /** The runner refused it: `code` is its `TG_*` (003 not connected, 004 Telegram refused). */
  | { kind: 'failed'; code: string; detail?: string };

/** The runner's refusal of a `telegram.link`, when one came: `TG_001` a token Telegram refused, `TG_002` another bot held. */
export interface TelegramLinkRefusal {
  code: string;
  detail?: string;
}

/** A `telegram.link` handed to the host. */
export interface TelegramLinkAttempt {
  /** False when the link would not take the frame. */
  sent: boolean;
  /**
   * The host's refusal, or null once none came in time. A token the host
   * took is answered by its `telegram.state` instead, so this settles null
   * then.
   */
  refused: Promise<TelegramLinkRefusal | null>;
}

/**
 * A host's Telegram bot, over its runner link (`product/next-steps/telegram.md`
 * §2): the token and the poller are the runner's, so everything the control
 * plane does to the bot is a frame to it. Connecting hands the token over
 * once, and is answered by the `telegram.state` the host reports (or a
 * refusal); disconnecting is fire and forget; a send waits for its answer.
 */
export interface TelegramDevicePort {
  reach(hostId: string): TelegramDeviceReach;
  /** Hand the host a bot's token to check, keep and poll. The token is never kept here. */
  link(hostId: string, token: string): TelegramLinkAttempt;
  /** Ask the host to forget its bot's token and outbox; false when nothing reached it. */
  unlink(hostId: string): boolean;
  send(
    hostId: string,
    chatId: string,
    text: string,
    replyToId?: string,
  ): Promise<TelegramSendOutcome>;
}
