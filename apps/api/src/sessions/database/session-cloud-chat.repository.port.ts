import type { CloudReplyDelivery } from '@oppenheimer/shared';

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
  /** Stores `lines` as numbers `from` on; a number already held keeps what it had. How many were new. */
  appendLines(
    organizationId: string,
    sessionId: string,
    from: number,
    lines: readonly string[],
  ): Promise<number>;
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
   * Hands a host's claim back to the Stop hook: the host certainly did not
   * send it. A reply the hook holds is left as it is.
   */
  releaseHostClaim(sessionId: string, replyId: string): Promise<void>;
}
