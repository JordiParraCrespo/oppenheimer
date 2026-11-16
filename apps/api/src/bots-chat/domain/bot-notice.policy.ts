/**
 * The words around a bot's notice (`notify`): what the tool answers the model,
 * and how many one turn may send. A
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

/**
 * When a bot speaks without being asked (2026-11-15, after OpenAI's dots:
 * "reaches out with results or decisions that need you"). One statement,
 * read by \`notify\` and by a routine's run, so the two cannot drift.
 */
export const WORTH_SAYING =
  'Speak only for something they asked to hear about, something that needs them (a decision, an approval, a blocker only they can clear), or something new and worth interrupting them for; routine progress, a retry that worked and a blocker you already told them about are not.';
