/**
 * A turn's budget for reading into its sessions: `read_session` (a session's
 * log) and `read_session_transcript`
 * (its agent's conversation) each answer within `BOT_TOOL_OUTPUT_MAX`, but a
 * broad turn — a recap over a day's work — calls them across dozens of
 * sessions, some of them huge, and the pages pile into the bot's own context
 * faster than its autocompaction can shed them. A turn that keeps reading
 * then thrashes compaction until the provider refuses the whole turn ("change
 * the message or the model"), losing the work, not just a read.
 *
 * So the two tools share one per-turn budget counted in the characters they
 * return: a turn reads freely until it has pulled
 * `SESSION_READ_CHARS_PER_TURN` characters of session material, then further
 * reads are refused with a note to answer from what it has or read a narrower
 * slice. The refusal costs a read; thrash costs the turn. Pure.
 */

import { promptText } from './bot-prompt-text.policy';
import { BOT_TOOL_OUTPUT_MAX } from './bot-tool-text.policy';

/** Where `read_session` and `read_session_transcript` meter their shared budget. */
export const SESSION_READ_BUDGET_KEY = 'session_reads';

/**
 * The characters of session log and conversation one turn may read before
 * further reads are refused. At `BOT_TOOL_OUTPUT_MAX` a page, this is roughly
 * 25 full pages, enough to look across a day's sessions and well short of the
 * context a turn thrashes at.
 */
export const SESSION_READ_CHARS_PER_TURN = 300_000;

/**
 * What one read adds to the budget: the characters it returned, never more
 * than a page holds (a page the engine will itself cut to `BOT_TOOL_OUTPUT_MAX`
 * is charged as that, not as the longer text the tool built).
 */
export function sessionReadCost(content: string): number {
  return Math.min(content.length, BOT_TOOL_OUTPUT_MAX);
}

/** Why no more session reads this turn, for the model to act on. */
export function sessionReadBudgetSpentRefusal(): string {
  return promptText('tools/sessions.read-budget-spent', {
    sessionReadCharsPerTurn: SESSION_READ_CHARS_PER_TURN.toLocaleString('en-US'),
  });
}
