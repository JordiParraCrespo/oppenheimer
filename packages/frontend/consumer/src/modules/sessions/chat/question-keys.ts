import type { ChatQuestion } from './session-chat';

/** What the person chose for one question: the options picked, by index, and an answer of their own. */
export interface ChatAnswer {
  picks: readonly number[];
  /** Their own words, in place of an option (single) or beside the picks (several). */
  other: string | null;
}

const DOWN = '\u001b[B';
const ENTER = '\r';

/**
 * The keys that answer Claude Code's `AskUserQuestion` picker the way a
 * person would at the terminal, one write each. Read off Claude Code 2.1's
 * picker, not its docs:
 *
 * - every question opens with the cursor on its first option, and a tab per
 *   question runs left to right;
 * - one choice: the option's number picks it and moves on. Its own answer is
 *   the row after the options ("Type something."): its number, the words,
 *   Enter;
 * - several: a number ticks its option and leaves the cursor where it is. The
 *   own answer is typed on that same row, reached with Down, which ticks it.
 *   The question's last row is Submit, Down again, and Enter moves on;
 * - then the review ("Submit answers" first), unless the only question was
 *   one choice, which a pick already sent.
 *
 * A newline in the person's words would be Enter, so it becomes a space.
 */
export function questionKeys(
  questions: readonly ChatQuestion[],
  answers: readonly ChatAnswer[],
): string[] {
  const keys: string[] = [];
  questions.forEach((question, index) => {
    const answer = answers[index] ?? { picks: [], other: null };
    const count = question.options.length;
    const other = answer.other?.replace(/\s*\n\s*/g, ' ').trim() || null;
    if (!question.multiSelect) {
      if (other) keys.push(String(count + 1), other, ENTER);
      else keys.push(String((answer.picks[0] ?? 0) + 1));
      return;
    }
    for (const pick of answer.picks) keys.push(String(pick + 1));
    if (other) keys.push(...Array<string>(count).fill(DOWN), other, DOWN);
    else keys.push(...Array<string>(count + 1).fill(DOWN));
    keys.push(ENTER);
  });
  const reviewed = questions.length > 1 || questions[0]?.multiSelect === true;
  if (reviewed) keys.push('1');
  return keys;
}
