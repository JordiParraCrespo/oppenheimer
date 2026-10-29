/**
 * What a turn's end means for a bot's goal (`25-bots.md` §4.1), and the
 * goal's own bounds. What breaks this: a person's Stop on a continuation, or
 * a failing one, letting the goal queue another; an unrelated turn's failure
 * ending a goal it has nothing to do with; a goal going past its limit; a
 * continuation keyed so that an end delivered twice queues two.
 */
import { BOT_GOAL_CONTINUATIONS_MAX } from '@oppenheimer/shared';
import { BotGoalEntity } from '../domain/bot-goal.entity';
import {
  goalContinuationTurn,
  goalDecision,
  goalEndLine,
  goalKeyPrefix,
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
  it('goes on after a completed turn, whoever started it', () => {
    expect(goalDecision(goal(), { id: 'turn-0', sourceKey: null, status: 'completed' })).toEqual({
      kind: 'continue',
    });
    expect(goalDecision(goal(1), { id: 'other', sourceKey: null, status: 'completed' })).toEqual({
      kind: 'continue',
    });
  });

  it('stops when a turn of the goal failed or was stopped, saying which', () => {
    const continuation = { id: 'turn-2', sourceKey: goalSourceKey('goal-1', 1) };
    expect(goalDecision(goal(1), { ...continuation, status: 'cancelled' })).toEqual({
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

  it('leaves the goal alone when a turn that is not its own failed', () => {
    expect(
      goalDecision(goal(1), { id: 'other', sourceKey: 'routine:a:b', status: 'failed' }),
    ).toEqual({ kind: 'skip' });
  });

  it('ends exhausted once every continuation has been queued', () => {
    expect(goalDecision(goal(3, 3), { id: 'x', sourceKey: null, status: 'completed' })).toEqual({
      kind: 'end',
      activity: 'exhausted',
      reason: null,
    });
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
      reason: null,
    });
    expect(opening.content).toContain('continuation 2 of 3');
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

  it('says how it ended in a line outside any turn', () => {
    const line = goalEndLine(goal(3, 3), 'exhausted', null);
    expect(line.turnId).toBeNull();
    expect(line.event).toMatchObject({ kind: 'goal', activity: 'exhausted', step: 3, limit: 3 });
  });
});
