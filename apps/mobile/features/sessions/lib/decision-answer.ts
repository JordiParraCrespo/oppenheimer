import type {
  AnswerSessionDecisionDto,
  SessionDecision,
} from '@oppenheimer/shared/schemas/session-decision';

type QuestionDecision = Extract<SessionDecision, { kind: 'question' }>;

/**
 * The answer to a question decision once each of its questions has its
 * picks: one entry per question, in order, with no free text (the phone
 * offers the agent's options; anything else is a reply). Null while a
 * question has nothing picked, so nothing half-answered is sent.
 */
export function questionAnswer(
  decision: QuestionDecision,
  picks: readonly (readonly number[])[],
): AnswerSessionDecisionDto | null {
  if (picks.length !== decision.questions.length) return null;
  if (picks.some((chosen) => chosen.length === 0)) return null;
  return {
    id: decision.id,
    answers: picks.map((chosen) => ({ picks: [...chosen], other: null })),
  };
}

/** The answer to a permission decision: the option, by its place on screen. */
export function permissionAnswer(decisionId: string, option: number): AnswerSessionDecisionDto {
  return { id: decisionId, option };
}

/**
 * The picks after a tap on option `index` of a question: a single-select
 * question takes that one, a multi-select one toggles it.
 */
export function togglePick(
  chosen: readonly number[],
  index: number,
  multiSelect: boolean,
): number[] {
  if (!multiSelect) return [index];
  return chosen.includes(index)
    ? chosen.filter((value) => value !== index)
    : [...chosen, index].sort((a, b) => a - b);
}
