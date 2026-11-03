/**
 * What a turn's end means for a bot's goal (`25-bots.md` §4.1), and the
 * goal's own bounds. What breaks this: a person's Stop on a continuation, or
 * a failing one, letting the goal queue another; a turn of it stopped at the
 * turn's time limit ending the goal instead of handing on to the next; an unrelated turn's failure
 * ending a goal it has nothing to do with; a goal going past its limit, or
 * going on after the reviewer found it met; a continuation keyed so that an
 * end delivered twice queues two; a `/goal` that shows or clears the goal
 * spending a turn.
 */
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
import { heldBy } from '../domain/bot-rate-limit.policy';

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
    failure: status === 'failed' ? ('other' as const) : null,
  });

  it('asks the reviewer after the turn that set it, or one of its continuations, completed', () => {
    expect(
      goalDecision(goal(), { id: 'turn-0', sourceKey: null, status: 'completed', failure: null }),
    ).toEqual({
      kind: 'review',
    });
    expect(goalDecision(goal(3, 3), own('completed', 3))).toEqual({ kind: 'review' });
  });

  // What breaks this: a person's message, a routine or a wake ending while a
  // continuation waits, queuing a second one beside it.
  it('changes nothing when a turn that is not the goal’s ends, however it ended', () => {
    for (const status of ['completed', 'failed', 'cancelled'] as const) {
      expect(
        goalDecision(goal(1), { id: 'other', sourceKey: 'routine:a:b', status, failure: null }),
      ).toEqual({
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
    expect(
      goalDecision(goal(), { id: 'turn-0', sourceKey: null, status: 'failed', failure: 'other' }),
    ).toEqual({
      kind: 'end',
      activity: 'stopped',
      reason: 'failed',
    });
  });

  // What breaks this: a long goal ending the moment one of its turns runs
  // past the turn's time limit, when the next continuation would carry on.
  it('reviews a turn of the goal stopped at the time limit, so the goal goes on', () => {
    expect(goalDecision(goal(1), { ...own('failed'), failure: 'time_limit' })).toEqual({
      kind: 'review',
    });
    expect(
      goalDecision(goal(1), {
        id: 'other',
        sourceKey: null,
        status: 'failed',
        failure: 'time_limit',
      }),
    ).toEqual({ kind: 'skip' });
  });
});

describe('goalOutcome', () => {
  const PROPS = { owner: 'owner-1' };

  it('ends the goal when the reviewer finds it met or out of reach, with its reason', () => {
    expect(goalOutcome(goal(1), { verdict: 'met', reason: 'CI is green' }, PROPS)).toEqual({
      kind: 'end',
      activity: 'met',
      reason: 'CI is green',
    });
    expect(goalOutcome(goal(1), { verdict: 'impossible', reason: 'No access' }, PROPS)).toEqual({
      kind: 'end',
      activity: 'impossible',
      reason: 'No access',
    });
  });

  // What breaks this: a reviewer that fails taking the goal down with it,
  // or a goal going past its limit because the reviewer keeps saying no.
  it('goes on with the reason while it is not met, or with none when there is no verdict', () => {
    expect(goalOutcome(goal(1), { verdict: 'not_met', reason: 'Two tests fail' }, PROPS)).toEqual({
      kind: 'continue',
      props: PROPS,
      reason: 'Two tests fail',
    });
    expect(goalOutcome(goal(1), null, PROPS)).toEqual({
      kind: 'continue',
      props: PROPS,
      reason: null,
    });
    expect(
      goalOutcome(goal(3, 3), { verdict: 'not_met', reason: 'Two tests fail' }, PROPS),
    ).toEqual({
      kind: 'end',
      activity: 'exhausted',
      reason: 'Two tests fail',
    });
  });

  // What breaks this: a goal going on for an owner who left the workspace.
  it('stops a goal that would go on when its owner can no longer act, and only then', () => {
    expect(goalOutcome(goal(1), { verdict: 'not_met', reason: 'x' }, null)).toEqual({
      kind: 'end',
      activity: 'stopped',
      reason: 'access_lost',
    });
    expect(goalOutcome(goal(1), { verdict: 'met', reason: 'done' }, null)).toMatchObject({
      activity: 'met',
    });
  });

  it('ends met rather than exhausted when the last continuation met it', () => {
    expect(goalOutcome(goal(3, 3), { verdict: 'met', reason: null }, PROPS)).toMatchObject({
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

  it('sets nothing for /goal alone or /goal clear, which the console runs', () => {
    expect(goalFromMessage('/goal', turn)).toBeNull();
    expect(goalFromMessage('/goal stop', turn)).toBeNull();
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
    expect(opening.content).not.toContain('minute limit');
  });

  // What breaks this: the turn after a timeout trying the same oversized step
  // again, and timing out on every continuation.
  it('tells the bot to take a smaller step when its last turn ran out of time', () => {
    const { opening } = goalContinuationTurn(
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
      null,
      true,
    );
    expect(opening.content).toContain('4-minute limit');
    expect(opening.content).toContain('smaller step');
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

describe('a goal waiting out a rate limit', () => {
  const limit = { system: 'Gmail', resetAt: new Date('2026-11-03T10:02:00.000Z') };

  // What breaks this: a goal set in place of another marked as waiting by
  // the old goal's continuation, so its banner says it waits while it works.
  it('is held only by its own turns: the one that set it and its continuations', () => {
    const own = goal();
    expect(own.isHeldBy({ id: 'turn-0', sourceKey: null })).toBe(true);
    expect(own.isHeldBy({ id: 'turn-2', sourceKey: goalSourceKey('goal-1', 2) })).toBe(true);
    expect(own.isHeldBy({ id: 'turn-9', sourceKey: goalSourceKey('goal-0', 1) })).toBe(false);
    expect(own.isHeldBy({ id: 'turn-9', sourceKey: null })).toBe(false);
  });

  // What breaks this: a banner that keeps saying it waits after the next
  // continuation was queued and the bot is working again.
  it('says what it waits for once held, and forgets it when its next continuation is counted', () => {
    const held = goal(1, 3);
    held.hold(limit);
    expect(held.waiting).toEqual(limit);
    held.advance();
    expect(held.waiting).toBeNull();
  });

  it('is held by a limit that has not passed, and by none that has', () => {
    const before = new Date('2026-11-03T10:01:00.000Z');
    const after = new Date('2026-11-03T10:03:00.000Z');
    expect(heldBy(limit, before)).toEqual(limit);
    expect(heldBy(limit, after)).toBeNull();
    expect(heldBy(null, before)).toBeNull();
  });
});
