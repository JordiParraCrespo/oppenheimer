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
 * How a bot answers a session it unblocks, said once for every place that
 * asks it to (the needs-input wake, `answer_session`). What escalates is
 * `answerNeedsPerson`'s; this only tells the bot.
 */
export const SESSION_UNBLOCK_RULE =
  "Answer what the session's task and the person's instructions point to, and turn down (the No option) what goes against the task. Letting a destructive dialog through (a recursive delete, a forced push, a history rewrite, dropping data, sudo) always goes to the person on a card of its own, whatever your permissions: still call answer_session with the option you recommend, and say in a sentence what it asks and why you recommend it.";

/**
 * What a permission dialog asks about when it names something that cannot
 * be taken back: a recursive delete, a history rewrite or a forced
 * push, wiping a disk or a database, root. Read on the dialog's title and
 * the command or file it shows. A command's flags are found anywhere in
 * it, before or after its operands (`rm dir -rf`, `git reset HEAD~3
 * --hard`), and a git command past its global options (`git -C <path>
 * push --force`); a command ends at a line, `;`, `&` or `|`.
 */
const ARGS = String.raw`[^\n;&|]*`;
const GIT = String.raw`\bgit\b${ARGS}?\s`;
const DESTRUCTIVE: readonly RegExp[] = [
  new RegExp(String.raw`\brm\b${ARGS}\s(?:-[a-z]*r[a-z]*\b|--recursive\b)`, 'i'),
  /\b(?:rimraf|shred|mkfs(?:\.\w+)?|wipefs)\b/i,
  new RegExp(String.raw`\bfind\b${ARGS}\s-delete\b`, 'i'),
  // A forced push, or one that deletes on the remote (`--delete`, `-d`, `:main`, `--mirror`).
  new RegExp(
    String.raw`${GIT}push\b${ARGS}(?:\s--(?:force(?:-with-lease)?|delete|mirror)\b|\s-[a-z]*[fd][a-z]*\b|\s[+:]\S)`,
    'i',
  ),
  new RegExp(String.raw`${GIT}reset\b${ARGS}\s--hard\b`, 'i'),
  new RegExp(String.raw`${GIT}clean\b${ARGS}\s(?:-[a-z]*f[a-z]*\b|--force\b)`, 'i'),
  // `-D` and `-M` delete or overwrite a branch whatever its state; `-d` alone
  // refuses an unmerged one, so this one is case-sensitive.
  new RegExp(String.raw`${GIT}branch\b${ARGS}\s-[a-zA-Z]*[DM][a-zA-Z]*\b`),
  // `-d` with `-f` in any spelling (`-df`, `-d -f`, `--delete --force`) is `-D`.
  new RegExp(
    String.raw`${GIT}branch\b(?=${ARGS}\s(?:-[a-z]*d[a-z]*\b|--delete\b))(?=${ARGS}\s(?:-[a-z]*f[a-z]*\b|--force\b))`,
  ),
  new RegExp(String.raw`${GIT}filter-(?:branch|repo)\b`, 'i'),
  /\bdrop\s+(?:table|database|schema)\b/i,
  /\btruncate\s+table\b/i,
  new RegExp(String.raw`\bdd\b${ARGS}\bof=`, 'i'),
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
