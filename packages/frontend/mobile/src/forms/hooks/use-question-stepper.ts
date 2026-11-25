import { useState } from 'react';
import {
  advanceQuestion,
  pickInQuestion,
  type QuestionMove,
  type QuestionPart,
  type QuestionStep,
  questionStepFor,
} from '../lib/question-stepper';

export interface QuestionStepper {
  /** The part being answered. */
  step: number;
  /** What that part has picked so far. */
  picked: readonly number[];
  pick: (index: number) => void;
  /** Send a multi-select part's picks: on to the next part, or the answer. */
  send: () => void;
}

/**
 * Answering an agent's or a bot's question one part at a time, for whichever
 * card draws it: the picks belong to the question `id`, so a new question
 * starts over; `onSubmit` gets one list of picks per part once the last is
 * answered. The rules are `question-stepper.ts`'s; this only holds the state.
 */
export function useQuestionStepper(
  id: string,
  parts: readonly QuestionPart[],
  onSubmit: (picks: number[][]) => void,
): QuestionStepper {
  const [held, setHeld] = useState<QuestionStep | null>(null);
  const state = questionStepFor(held, id);

  const apply = ({ state: next, submit }: QuestionMove) => {
    setHeld(next);
    if (submit) onSubmit(submit);
  };

  return {
    step: state.step,
    picked: state.picks[state.step] ?? [],
    pick: (index) => apply(pickInQuestion(state, parts, index)),
    send: () => apply(advanceQuestion(state, parts)),
  };
}
