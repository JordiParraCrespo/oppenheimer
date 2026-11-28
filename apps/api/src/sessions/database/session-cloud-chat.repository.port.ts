import type { CloudChatSource, CloudReplyDelivery } from '@oppenheimer/shared';

/** A line of a cloud session's transcript, numbered from 0. */
export interface CloudChatLine {
  seq: number;
  line: string;
}

/** What a person typed in a cloud session's chat. */
export interface CloudChatReply {
  id: string;
  authorId: string | null;
  text: string;
  createdAt: Date;
  /** When it reached the agent, by either way; null while it waits. */
  collectedAt: Date | null;
  /** Which way it reached the agent; null exactly while it waits. */
  deliveredVia: CloudReplyDelivery | null;
}

/** An event of a session's log on claude.ai, as the browser extension read it. */
export interface CloudChatEvent {
  /** The id claude.ai gave it. */
  id: string;
  /** The transcript entry it is, as JSON text. */
  line: string;
}

/** A reply the browser extension claimed, with the claude.ai session it is for. */
export interface BrowserCloudReply extends CloudChatReply {
  cloudSessionId: string;
}

/** A waiting reply's wake: the job that has a host send it once the Stop hook has had its time. */
export interface CloudReplyWake {
  sessionId: string;
  replyId: string;
}

/**
 * A Claude Code cloud session's chat: its transcript lines and the replies
 * waiting for its Stop hook. Unscoped by design, as the terminal watches are:
 * every caller loads the session through a scoped read first and passes its
 * ids here.
 */
export interface SessionCloudChatRepositoryPort {
  /**
   * Stores `lines` as numbers `from` on; a number already held keeps what it
   * had, and a session the extension has read takes none. How many were new.
   */
  appendLines(
    organizationId: string,
    sessionId: string,
    from: number,
    lines: readonly string[],
  ): Promise<number>;
  /**
   * Stores events the browser extension read, after the lines already held,
   * skipping any it holds already; the first batch for a session replaces the
   * lines its hook sent, which `appendLines` then leaves alone. How many were new.
   */
  appendEvents(
    organizationId: string,
    sessionId: string,
    events: readonly CloudChatEvent[],
  ): Promise<number>;
  /** Where the session's lines came from: the extension once it has sent any, else the hook. */
  findSource(sessionId: string): Promise<CloudChatSource>;
  /** The lines numbered `from` and on, in order, at most `limit`. */
  findLines(sessionId: string, from: number, limit: number): Promise<CloudChatLine[]>;
  /**
   * A reply for the agent, waiting until the Stop hook collects it, with its
   * wake staged in the same transaction for `wakeAt`: a reply is never kept
   * without the job that sends it if the hook does not come.
   */
  addReply(
    organizationId: string,
    sessionId: string,
    authorId: string,
    text: string,
    wakeAt: Date,
  ): Promise<CloudChatReply>;
  /** The session's replies, oldest first, at most `limit`. */
  findReplies(organizationId: string, sessionId: string, limit: number): Promise<CloudChatReply[]>;
  /**
   * The oldest reply still waiting, now collected at the database's time (the
   * clock its `createdAt` came from); none waiting is null. Two hooks never
   * take one.
   */
  collectReply(sessionId: string): Promise<CloudChatReply | null>;
  /**
   * The reply `replyId` of `sessionId`, claimed for a host to send it, if it
   * still waits; null when the hook (or an earlier wake) took it. The same
   * claim as `collectReply`'s, so only one of them ever has it.
   */
  claimReplyForHost(sessionId: string, replyId: string): Promise<CloudChatReply | null>;
  /**
   * Every reply `authorId` typed that still waits, in this workspace's Claude
   * Code cloud sessions that are still open, now claimed for the browser
   * extension to post on claude.ai as that person; oldest first. The same
   * claim as the hook's and the host's, so only one of them ever has a reply.
   * The claim holds `leaseSeconds`: unconfirmed past it, the reply waits again
   * for any of the three, so a claim whose post never happened is not lost.
   */
  claimRepliesForBrowser(
    organizationId: string,
    authorId: string,
    leaseSeconds: number,
  ): Promise<BrowserCloudReply[]>;
  /**
   * When the browser extension holds a reply's claim, unconfirmed, the wake
   * that found it taken is staged again for just after the claim's lease ends,
   * so a reply the extension never posts still reaches a host. Answers when,
   * or null when nothing holds it that way (delivered, or another way's).
   */
  deferWakeWhileLeased(sessionId: string, replyId: string): Promise<Date | null>;
  /**
   * The extension's word that claude.ai took a reply it claimed: the claim no
   * longer lapses. Whether it was the caller's claim, still held.
   */
  confirmBrowserDelivery(
    organizationId: string,
    authorId: string,
    replyId: string,
  ): Promise<boolean>;
  /**
   * Hands a reply the extension claimed back, when claude.ai refused it, so
   * the Stop hook or a host can deliver it. Whether it was the extension's.
   */
  releaseBrowserClaim(organizationId: string, authorId: string, replyId: string): Promise<boolean>;
  /**
   * Hands a host's claim back to the Stop hook: the host certainly did not
   * send it. A reply the hook holds is left as it is.
   */
  releaseHostClaim(sessionId: string, replyId: string): Promise<void>;
}
