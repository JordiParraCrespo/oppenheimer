import type { SessionQuestionDecision } from '@oppenheimer/shared/schemas/session-decision';

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

/** "Keep both · Gateway, Redis": what was answered, for the log line. */
export function answerSummary(
  decision: SessionQuestionDecision,
  answers: readonly InboxAnswer[],
): string {
  return decision.questions
    .map((question, index) => {
      const answer = answers[index] ?? UNANSWERED;
      const words = [
        ...answer.picks.flatMap((pick) => question.options[pick]?.label ?? []),
        answer.other.trim(),
      ].filter(Boolean);
      return words.join(', ');
    })
    .join(' · ');
}
