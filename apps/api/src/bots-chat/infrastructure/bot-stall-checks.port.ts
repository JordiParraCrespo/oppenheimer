/** One task a bot handed a session, owed its stall check. */
export interface StallCheck {
  subscriptionId: string;
  botId: string;
  sessionId: string;
  /** The task handed off. */
  turn: number;
  /** Which check of the task, from 1 (§4.2). */
  check: number;
}

/**
 * Owes a hand-off a check at `at` (`27-bot-subscriptions.md` §4.1, §4.2),
 * durably: the check runs once the time comes, across a restart.
 */
export interface BotStallChecksPort {
  schedule(check: StallCheck, at: Date, correlationId: string | null): Promise<void>;
}
