import type { AnswerSessionDecisionDto, SessionDecision } from '@oppenheimer/shared';
import { permissionKeys, questionKeys } from '@oppenheimer/shared/sessions';

/**
 * Whether an answer fits the decision a session waits on, and the keys that
 * give it to the agent the way a person would at its terminal
 * (`28-inbox.md` slice 4). The keys are the console's own encoding
 * (`questionKeys` in `@oppenheimer/shared/sessions`), so an answer from the
 * Inbox and one from the chat view land on the same option.
 *
 * - `stale`: nothing is pending, or what is pending is not what the answer
 *   names. The person answered something they no longer see.
 * - `invalid`: the answer does not fit what is pending.
 */
export type DecisionAnswerOutcome =
  | { kind: 'keys'; keys: string[] }
  | { kind: 'stale' | 'invalid'; detail: string };

export function decisionAnswerKeys(
  pending: SessionDecision | null,
  answer: AnswerSessionDecisionDto,
): DecisionAnswerOutcome {
  if (!pending || pending.id !== answer.id) {
    return {
      kind: 'stale',
      detail: pending
        ? 'The session now waits on another decision.'
        : 'The session waits on no decision now.',
    };
  }
  if (pending.kind === 'permission') {
    if (answer.option === undefined) {
      return invalid('A permission dialog is answered with an option.');
    }
    if (answer.option >= pending.options.length) {
      return invalid(`The dialog has ${pending.options.length} options.`);
    }
    return { kind: 'keys', keys: permissionKeys(answer.option) };
  }

  if (!answer.answers) return invalid('A question is answered with one answer each.');
  if (answer.answers.length !== pending.questions.length) {
    return invalid(`It asks ${pending.questions.length} questions.`);
  }
  for (const [index, question] of pending.questions.entries()) {
    const item = answer.answers[index];
    if (!item) return invalid(`Question ${index + 1} has no answer.`);
    const own = item.other?.trim() ? 1 : 0;
    if (item.picks.some((pick) => pick >= question.options.length)) {
      return invalid(`Question ${index + 1} has ${question.options.length} options.`);
    }
    if (new Set(item.picks).size !== item.picks.length) {
      return invalid(`Question ${index + 1} names an option twice.`);
    }
    if (!question.multiSelect && item.picks.length + own !== 1) {
      return invalid(`Question ${index + 1} takes one option or an answer of your own.`);
    }
    if (question.multiSelect && item.picks.length + own === 0) {
      return invalid(`Question ${index + 1} has no answer.`);
    }
  }
  return { kind: 'keys', keys: questionKeys(pending.questions, answer.answers) };
}

function invalid(detail: string): DecisionAnswerOutcome {
  return { kind: 'invalid', detail };
}
