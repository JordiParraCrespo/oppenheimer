import type {
  CommandFailedMessage,
  FsListingMessage,
  PortListingMessage,
  WhatsappSentMessage,
} from '@oppenheimer/shared/protocol';

/**
 * A runner's answer to a command the control plane is waiting on: the reply
 * frame itself, or its refusal: `fs.listing`, `port.listing` or `whatsapp.sent`.
 */
export type LinkReply =
  | FsListingMessage
  | PortListingMessage
  | WhatsappSentMessage
  | CommandFailedMessage;

/** One waiter: the reply, or null when none came in time. */
export interface PendingReply {
  readonly reply: Promise<LinkReply | null>;
  /** Stop waiting now (the command was never sent); the reply resolves null. */
  cancel(): void;
}

/**
 * Request and response over the runner link, which is otherwise fire and
 * forget: a command that wants an answer registers a waiter by its
 * `commandId` before it is sent, and the gateway hands the matching reply here
 * before routing it anywhere else.
 *
 * In process, like the link registry it sits beside: the relay and the API are
 * one process, so the socket that receives the reply is the one this process
 * sent the command on. When the relay splits off, this becomes a reply
 * channel between the two, and this port is where that lands.
 */
export interface LinkRepliesPort {
  /**
   * Wait for the reply to `commandId` from `hostId`'s link, for at most
   * `timeoutMs`. A reply from another host's link never settles it.
   */
  expect(hostId: string, commandId: string, timeoutMs: number): PendingReply;
  /** Route an inbound reply; true when a waiter took it, so nothing else should. */
  settle(hostId: string, reply: LinkReply): boolean;
}
