import { promptText } from './bot-prompt-text.policy';

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
  return promptText('tools/notice.notice-sent');
}

/** What the model reads when the turn already sent its share. */
export function noticesSpent(): string {
  return promptText('tools/notice.notices-spent', { noticesPerTurn: String(BOT_NOTICES_PER_TURN) });
}

/**
 * When a bot speaks without being asked (2026-11-15, after OpenAI's dots:
 * "reaches out with results or decisions that need you"). One statement,
 * read by \`notify\` and by a routine's run, so the two cannot drift.
 */
export const WORTH_SAYING = promptText('wake/worth-saying');
