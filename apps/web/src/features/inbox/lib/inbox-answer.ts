/** What the reader chose for one question on the card: options by index, and words of their own. */
export interface InboxAnswer {
  picks: number[];
  other: string;
}

export const UNANSWERED: InboxAnswer = { picks: [], other: '' };

/** Whether a question has an answer: a pick, or words of the reader's own. */
export function isAnswered(answer: InboxAnswer | undefined): boolean {
  return Boolean(answer && (answer.picks.length > 0 || answer.other.trim()));
}

/** The body's `answers`: one per question, in order, the words trimmed and absent when blank. */
export function toAnswers(answers: readonly InboxAnswer[]) {
  return answers.map((answer) => ({
    picks: answer.picks,
    other: answer.other.trim() || null,
  }));
}
