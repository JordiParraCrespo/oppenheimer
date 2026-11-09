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
  /** When the session's Stop hook took it; null while it waits. */
  collectedAt: Date | null;
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
  /** A reply for the agent, waiting until the Stop hook collects it. */
  addReply(
    organizationId: string,
    sessionId: string,
    authorId: string,
    text: string,
  ): Promise<CloudChatReply>;
  /** The session's replies, oldest first, at most `limit`. */
  findReplies(organizationId: string, sessionId: string, limit: number): Promise<CloudChatReply[]>;
  /**
   * The oldest reply still waiting, now collected at the database's time (the
   * clock its `createdAt` came from); none waiting is null. Two hooks never
   * take one.
   */
  collectReply(sessionId: string): Promise<CloudChatReply | null>;
}
