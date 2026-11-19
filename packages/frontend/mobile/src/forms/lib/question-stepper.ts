/** Where answering a multi-part question stands: which part, and what each part has picked. */
export interface QuestionStep {
  /** The question being answered; a new one starts over. */
  id: string;
  step: number;
  picks: readonly (readonly number[])[];
}

/** One part of the question, as far as answering it goes. */
export interface QuestionPart {
  multiSelect: boolean;
}

/**
 * What a pick or a Send does: the state to hold next, and the picks to send
 * when the last part is answered (null while there is a part still to go).
 */
export interface QuestionMove {
  state: QuestionStep;
  submit: number[][] | null;
}

/** The state for question `id`: the one held while it is still that question, else a fresh start. */
export function questionStepFor(held: QuestionStep | null, id: string): QuestionStep {
  return held && held.id === id ? held : { id, step: 0, picks: [] };
}

/** Past the current part: on to the next, or, from the last, the picks to send. */
export function advanceQuestion(state: QuestionStep, parts: readonly QuestionPart[]): QuestionMove {
  if (state.step + 1 < parts.length)
    return { state: { ...state, step: state.step + 1 }, submit: null };
  return { state, submit: state.picks.map((chosen) => [...chosen]) };
}

/**
 * A tap on option `index` of the current part. A single-select part takes it
 * and moves on (or sends, on the last part); a multi-select part toggles it
 * and waits for Send (`advanceQuestion`).
 */
export function pickInQuestion(
  state: QuestionStep,
  parts: readonly QuestionPart[],
  index: number,
): QuestionMove {
  const part = parts[state.step];
  if (!part) return { state, submit: null };
  const chosen = state.picks[state.step] ?? [];
  const next = part.multiSelect
    ? chosen.includes(index)
      ? chosen.filter((value) => value !== index)
      : [...chosen, index].sort((a, b) => a - b)
    : [index];
  const picks = [...state.picks];
  picks[state.step] = next;
  const picked = { ...state, picks };
  return part.multiSelect ? { state: picked, submit: null } : advanceQuestion(picked, parts);
}
