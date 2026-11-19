import { describe, expect, it } from 'vitest';
import { advanceQuestion, pickInQuestion, questionStepFor } from '../lib/question-stepper';

/**
 * Answering a multi-part question on the phone, for a session's agent and a
 * bot alike. What breaks if it drifts: a single pick that never sends, a
 * multi-select that sends on its first tap, picks carried over to the next
 * question, or an answer with a part missing.
 */
describe('the question stepper', () => {
  const parts = [{ multiSelect: false }, { multiSelect: true }];

  it('moves on after a single pick, and sends once the last part is done', () => {
    const first = pickInQuestion(questionStepFor(null, 'q'), parts, 1);
    expect(first.submit).toBeNull();
    expect(first.state.step).toBe(1);
    const toggled = pickInQuestion(pickInQuestion(first.state, parts, 2).state, parts, 0);
    expect(toggled.submit).toBeNull();
    expect(advanceQuestion(toggled.state, parts).submit).toEqual([[1], [0, 2]]);
  });

  it('toggles a multi-select pick off again', () => {
    const on = pickInQuestion(questionStepFor(null, 'q'), [{ multiSelect: true }], 3).state;
    expect(pickInQuestion(on, [{ multiSelect: true }], 3).state.picks).toEqual([[]]);
  });

  it('starts over for a new question', () => {
    const held = pickInQuestion(questionStepFor(null, 'q'), parts, 1).state;
    expect(questionStepFor(held, 'q')).toBe(held);
    expect(questionStepFor(held, 'other')).toEqual({ id: 'other', step: 0, picks: [] });
  });
});
