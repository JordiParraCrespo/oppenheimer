import type { SessionDecision } from '@oppenheimer/shared';

/**
 * What a bot may answer on its own when a session it follows is blocked
 * (`25-bots.md` §4.2, `answer_session`). A bot unblocks a session as a person
 * who delegated the work would: questions about how to do the task and
 * permissions for the steps it needs. One kind of answer is never the bot's
 * alone, whatever its preset or grants say: letting the agent run something
 * destructive. Such a call goes on a card of its own, so the person decides
 * it from the chat instead of having to open the session.
 */

/**
 * What a permission dialog asks about when it names something that cannot
 * be taken back: a recursive delete, a history rewrite or a forced
 * push, wiping a disk or a database, root. Read on the dialog's title and
 * the command or file it shows.
 */
const DESTRUCTIVE: readonly RegExp[] = [
  /\brm\s+(?:-[a-z]*\s+)*-[a-z]*r/i,
  /\brm\s+(?:\S+\s+)*--recursive\b/i,
  /\b(?:rimraf|shred|mkfs(?:\.\w+)?|wipefs)\b/i,
  /\bfind\b[^\n]*\s-delete\b/i,
  /\bgit\s+push\b[^\n]*(?:\s--force(?:-with-lease)?\b|\s-f\b|\s\+\S)/i,
  /\bgit\s+(?:reset\s+--hard\b|clean\s+-[a-z]*f|branch\s+-D\b|filter-(?:branch|repo)\b)/i,
  /\bdrop\s+(?:table|database|schema)\b/i,
  /\btruncate\s+table\b/i,
  /\bdd\s+[^\n]*\bof=/i,
  /\bsudo\b/i,
  /\brecursive(?:ly)?\s+delet/i,
];

/** Whether a permission option turns the dialog down ("No", "No, and tell Claude…"). */
function refuses(label: string): boolean {
  return /^\s*(?:no\b|deny\b|reject\b|cancel\b)/i.test(label);
}

/** Whether a dialog asks to let something destructive run. */
export function isDestructiveDecision(decision: SessionDecision): boolean {
  if (decision.kind !== 'permission') return false;
  const text = `${decision.title}\n${decision.detail ?? ''}`;
  return DESTRUCTIVE.some((pattern) => pattern.test(text));
}

/**
 * Whether an answer must be the person's own call: it lets a destructive
 * dialog through. Turning one down, or answering a question, is the bot's
 * to make within its permissions. An answer to a decision the session no
 * longer waits on is refused before this matters.
 */
export function answerNeedsPerson(
  decision: SessionDecision | null,
  answer: { decisionId: string; option?: number },
): boolean {
  if (!decision || decision.id !== answer.decisionId || decision.kind !== 'permission') {
    return false;
  }
  if (answer.option === undefined) return false;
  const option = decision.options[answer.option];
  if (!option || refuses(option.label)) return false;
  return isDestructiveDecision(decision);
}
