/**
 * What a turn's end means for a bot's goal (`25-bots.md` §4.1), and the
 * goal's own bounds. What breaks this: a person's Stop on a continuation, or
 * a failing one, letting the goal queue another; an unrelated turn's failure
 * ending a goal it has nothing to do with; a goal going past its limit, or
 * going on after the reviewer found it met; a continuation keyed so that an
 * end delivered twice queues two; a `/goal` that shows or clears the goal
 * spending a turn.
 */
import { ArgumentInvalidException } from '@oppenheimer/backend-ddd';
import { BOT_GOAL_CONTINUATIONS_MAX, BOT_GOAL_CONTINUATIONS_PERSON } from '@oppenheimer/shared';
import { BotGoalEntity } from '../domain/bot-goal.entity';
import {
  goalContinuationTurn,
  goalDecision,
  goalEndLine,
  goalFromMessage,
  goalKeyPrefix,
  goalOutcome,
  goalSourceKey,
} from '../domain/bot-goal.policy';

function goal(continuations = 0, limit = 3): BotGoalEntity {
  return BotGoalEntity.create({
    id: 'goal-1',
    props: {
      organizationId: 'org-1',
      botId: 'bot-1',
      originTurnId: 'turn-0',
      objective: 'Get the release branch green',
      limit,
      continuations,
      credentialScopes: null,
      timeZone: 'Europe/Madrid',
    },
  });
}

describe('goalDecision', () => {
  const own = (status: 'completed' | 'failed' | 'cancelled', step = 1) => ({
    id: `turn-${step}`,
    sourceKey: goalSourceKey('goal-1', step),
    status,
  });

  it('asks the reviewer after the turn that set it, or one of its continuations, completed', () => {
    expect(goalDecision(goal(), { id: 'turn-0', sourceKey: null, status: 'completed' })).toEqual({
      kind: 'review',
    });
    expect(goalDecision(goal(3, 3), own('completed', 3))).toEqual({ kind: 'review' });
  });

  // What breaks this: a person's message, a routine or a wake ending while a
  // continuation waits, queuing a second one beside it.
  it('changes nothing when a turn that is not the goal’s ends, however it ended', () => {
    for (const status of ['completed', 'failed', 'cancelled'] as const) {
      expect(goalDecision(goal(1), { id: 'other', sourceKey: 'routine:a:b', status })).toEqual({
        kind: 'skip',
      });
    }
  });

  it('stops when a turn of the goal failed or was stopped, saying which', () => {
    expect(goalDecision(goal(1), own('cancelled'))).toEqual({
      kind: 'end',
      activity: 'stopped',
      reason: 'cancelled',
    });
    expect(goalDecision(goal(), { id: 'turn-0', sourceKey: null, status: 'failed' })).toEqual({
      kind: 'end',
      activity: 'stopped',
      reason: 'failed',
    });
  });
});

describe('goalOutcome', () => {
  it('ends the goal when the reviewer finds it met or out of reach, with its reason', () => {
    expect(goalOutcome(goal(1), { verdict: 'met', reason: 'CI is green' })).toEqual({
      kind: 'end',
      activity: 'met',
      reason: 'CI is green',
    });
    expect(goalOutcome(goal(1), { verdict: 'impossible', reason: 'No access' })).toEqual({
      kind: 'end',
      activity: 'impossible',
      reason: 'No access',
    });
  });

  // What breaks this: a reviewer that fails taking the goal down with it,
  // or a goal going past its limit because the reviewer keeps saying no.
  it('goes on with the reason while it is not met, or with none when there is no verdict', () => {
    expect(goalOutcome(goal(1), { verdict: 'not_met', reason: 'Two tests fail' })).toEqual({
      kind: 'continue',
      reason: 'Two tests fail',
    });
    expect(goalOutcome(goal(1), null)).toEqual({ kind: 'continue', reason: null });
    expect(goalOutcome(goal(3, 3), { verdict: 'not_met', reason: 'Two tests fail' })).toEqual({
      kind: 'end',
      activity: 'exhausted',
      reason: 'Two tests fail',
    });
  });

  it('ends met rather than exhausted when the last continuation met it', () => {
    expect(goalOutcome(goal(3, 3), { verdict: 'met', reason: null })).toMatchObject({
      activity: 'met',
    });
  });
});

describe('goalFromMessage', () => {
  const turn = {
    organizationId: 'org-1',
    botId: 'bot-1',
    id: 'turn-9',
    credentialScopes: null,
    timeZone: 'UTC',
  };

  it('sets a goal on the turn for /goal <condition>, with the whole of the limit', () => {
    const set = goalFromMessage('/goal pnpm test exits 0', turn);
    expect(set).toMatchObject({
      objective: 'pnpm test exits 0',
      originTurnId: 'turn-9',
      limit: BOT_GOAL_CONTINUATIONS_PERSON,
      continuations: 0,
    });
  });

  it('sets nothing for a message that is not /goal', () => {
    expect(goalFromMessage('/release-notes v2', turn)).toBeNull();
    expect(goalFromMessage('what is the goal?', turn)).toBeNull();
  });

  it('refuses /goal alone and /goal clear, which the console runs without a turn', () => {
    expect(() => goalFromMessage('/goal', turn)).toThrow(ArgumentInvalidException);
    expect(() => goalFromMessage('/goal stop', turn)).toThrow(ArgumentInvalidException);
  });
});

describe('a continuation', () => {
  it('is a goal turn in the background lane, keyed by the goal and its number, opened by a goal line', () => {
    const { turn, opening } = goalContinuationTurn(
      {
        organizationId: 'org-1',
        botId: 'bot-1',
        requestedByUserId: 'owner-1',
        provider: 'anthropic',
        model: 'claude-sonnet-5-5',
        effort: null,
      },
      goal(1),
      2,
      'Two tests still fail',
    );
    expect(turn).toMatchObject({ origin: 'goal', lane: 'background', sourceKey: 'goal:goal-1:2' });
    expect(turn.sourceKey?.startsWith(goalKeyPrefix('goal-1'))).toBe(true);
    expect(opening.event).toEqual({
      kind: 'goal',
      activity: 'continued',
      goalId: 'goal-1',
      objective: 'Get the release branch green',
      step: 2,
      limit: 3,
      reason: 'Two tests still fail',
    });
    expect(opening.content).toContain('continuation 2 of 3');
    expect(opening.content).toContain('Two tests still fail');
    expect(opening.content).toContain('end_goal');
  });
});

describe('BotGoalEntity', () => {
  it('counts continuations up to its limit and no further', () => {
    const open = goal(2, 3);
    expect(open.advance()).toBe(3);
    expect(open.exhausted).toBe(true);
    expect(() => open.advance()).toThrow();
  });

  it(`refuses an empty objective and a limit outside 1 to ${BOT_GOAL_CONTINUATIONS_MAX}`, () => {
    const base = {
      organizationId: 'org-1',
      botId: 'bot-1',
      originTurnId: 'turn-0',
      credentialScopes: null,
      timeZone: null,
    };
    expect(() => BotGoalEntity.set({ ...base, objective: '  ', limit: 3 })).toThrow();
    expect(() => BotGoalEntity.set({ ...base, objective: 'x', limit: 0 })).toThrow();
    expect(() =>
      BotGoalEntity.set({ ...base, objective: 'x', limit: BOT_GOAL_CONTINUATIONS_MAX + 1 }),
    ).toThrow();
  });

  it('says how it ended in a line outside any turn, with the reviewer’s reason', () => {
    const line = goalEndLine(goal(3, 3), 'exhausted', null);
    expect(line.turnId).toBeNull();
    expect(line.event).toMatchObject({ kind: 'goal', activity: 'exhausted', step: 3, limit: 3 });
    const met = goalEndLine(goal(2, 3), 'met', 'CI is green on main');
    expect(met.event).toMatchObject({ activity: 'met', reason: 'CI is green on main' });
    expect(met.content).toContain('CI is green on main');
  });
});
