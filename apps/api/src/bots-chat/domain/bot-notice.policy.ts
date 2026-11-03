/**
 * The words around a bot's notice (`notify`, `product/next-steps/agent-tools.md`
 * §5): what the tool answers the model, and how many one turn may send. A
 * notice replaces the last, so a second in one turn is a correction at most;
 * more would only churn the person's Inbox.
 */

/** The most notices one turn may send. */
export const BOT_NOTICES_PER_TURN = 2;

/** What the model reads once its line is in the person's Inbox. */
export function noticeSent(): string {
  return "Sent: your line is in the person's Inbox, in place of any earlier notice of yours. Do not repeat it in this turn.";
}

/** What the model reads when the turn already sent its share. */
export function noticesSpent(): string {
  return `Not sent: you have already sent ${BOT_NOTICES_PER_TURN} notices this turn, the most one turn may send. Your last one stands.`;
}
