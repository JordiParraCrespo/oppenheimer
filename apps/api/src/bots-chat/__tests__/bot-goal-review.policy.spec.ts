/**
 * What the goal reviewer is sent and how its answer is read (`25-bots.md`
 * §4.1). What breaks this: an answer with prose around its JSON, or a
 * verdict it was never offered, read as one; a malformed answer throwing
 * where it should be no verdict (the goal goes on within its limit); a long
 * conversation sent whole, or cut so the newest turn is lost.
 */
import {
  BOT_GOAL_REASON_MAX,
  BOT_GOAL_REVIEW_TOKEN_BUDGET,
  composeGoalReview,
  goalReviewTranscript,
  goalVerdict,
} from '../domain/bot-goal-review.policy';

describe('goalVerdict', () => {
  it('reads each of the three verdicts and its reason, with prose around the JSON', () => {
    expect(goalVerdict('{"verdict":"met","reason":"pnpm test exited 0"}')).toEqual({
      verdict: 'met',
      reason: 'pnpm test exited 0',
    });
    expect(goalVerdict('Here: {"verdict": "not_met", "reason": "two\\n tests fail"} done')).toEqual(
      { verdict: 'not_met', reason: 'two tests fail' },
    );
    expect(goalVerdict('{"verdict":"impossible"}')).toEqual({
      verdict: 'impossible',
      reason: null,
    });
  });

  it('is no verdict for an answer with no JSON, broken JSON or a verdict not offered', () => {
    for (const answer of ['met', '{"verdict": met}', '{"verdict":"done"}', '']) {
      expect(goalVerdict(answer)).toBeNull();
    }
  });

  // What breaks this: a greedy match from the first `{` to the last `}`
  // reading two objects, or a brace in the prose, as one broken verdict.
  it('reads a fenced answer, and the first object that holds a verdict among several', () => {
    expect(goalVerdict('```json\n{"verdict":"met","reason":"done"}\n```')).toEqual({
      verdict: 'met',
      reason: 'done',
    });
    expect(
      goalVerdict(
        'Checked {the tests}. {"verdict":"not_met","reason":"a } in a string"} and {"verdict":"met"}',
      ),
    ).toEqual({ verdict: 'not_met', reason: 'a } in a string' });
  });

  it('cuts a long reason to what a goal line holds', () => {
    const verdict = goalVerdict(JSON.stringify({ verdict: 'not_met', reason: 'x'.repeat(5_000) }));
    expect(verdict?.reason).toHaveLength(BOT_GOAL_REASON_MAX);
  });
});

describe('composeGoalReview', () => {
  it('sends the condition and the conversation as data, saying whose words each entry is', () => {
    const message = composeGoalReview('CI is green', [
      { role: 'user', text: 'Fix the build' },
      { role: 'assistant', text: 'pnpm test exited 0' },
    ]);
    expect(message).toContain('<goal>\nCI is green\n</goal>');
    expect(message).toContain('[person or Oppenheimer]\nFix the build');
    expect(message).toContain('[assistant]\npnpm test exited 0');
  });

  it('keeps the newest of a long conversation within its budget, the last turn always in', () => {
    const old = { role: 'assistant' as const, text: 'o'.repeat(BOT_GOAL_REVIEW_TOKEN_BUDGET * 4) };
    const message = composeGoalReview('CI is green', [old, { role: 'assistant', text: 'newest' }]);
    expect(message).toContain('newest');
    expect(message).not.toContain('ooo');
  });
});

describe('goalReviewTranscript', () => {
  it('reads the conversation back without the bot’s working, the ended turn’s words last', () => {
    expect(
      goalReviewTranscript(
        [
          { role: 'user', content: 'Fix the build' },
          { role: 'activity', content: 'ran pnpm test' },
          { role: 'assistant', content: 'On it' },
        ],
        ['pnpm test exited 0'],
      ),
    ).toEqual([
      { role: 'user', text: 'Fix the build' },
      { role: 'assistant', text: 'On it' },
      { role: 'assistant', text: 'pnpm test exited 0' },
    ]);
  });
});
