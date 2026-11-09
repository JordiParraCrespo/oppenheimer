/**
 * What a turn's end means for a bot's goal (`25-bots.md` §4.1), and the
 * goal's own bounds, since goals have no limit of continuations (2026-11-09).
 * What breaks this: a goal ending on the first failed or stopped turn instead
 * of pausing where the owner can resume it; a goal going on forever with
 * turns that do nothing, or past its budget; a claim that it is met ending
 * it without the reviewer; a goal set before the change running past the
 * limit it was promised; a continuation keyed so that an end delivered twice
 * queues two; a `/goal` that shows or clears the goal spending a turn.
 */
import { BOT_GOAL_IDLE_TURNS, type BotTurnFailure } from '@oppenheimer/shared';
import { BotGoalEntity, type BotGoalProps } from '../domain/bot-goal.entity';
import {
  type EndedTurn,
  goalContinuationTurn,
  goalDecision,
  goalEndLine,
  goalFromMessage,
  goalKeyPrefix,
  goalOutcome,
  goalPauseLine,
  goalSourceKey,
  isDecidedTurn,
} from '../domain/bot-goal.policy';
import { heldBy } from '../domain/bot-rate-limit.policy';

function goal(props: Partial<BotGoalProps> = {}): BotGoalEntity {
  return BotGoalEntity.create({
    id: 'goal-1',
    props: {
      organizationId: 'org-1',
      botId: 'bot-1',
      originTurnId: 'turn-0',
      objective: 'Get the release branch green',
      limit: null,
      continuations: 0,
      tokensUsed: 0,
      tokenBudget: null,
      idleTurns: 0,
      claim: null,
      paused: null,
      credentialScopes: null,
      timeZone: 'Europe/Madrid',
      ...props,
    },
  });
}

function own(
  status: 'completed' | 'failed' | 'cancelled',
  failure: BotTurnFailure | null = status === 'failed' ? 'other' : null,
  step = 1,
): EndedTurn {
  return {
    id: `turn-${step}`,
    sourceKey: goalSourceKey('goal-1', step),
    status,
    failure,
    error: failure ? 'It broke' : null,
  };
}

const CONTINUATION_PROPS = {
  organizationId: 'org-1',
  botId: 'bot-1',
  requestedByUserId: 'owner-1',
  provider: 'anthropic' as const,
  model: 'claude-sonnet-5-5',
  effort: null,
};

describe('goalDecision', () => {
  it('goes on after the turn that set it, or one of its continuations, with no limit', () => {
    const origin: EndedTurn = {
      id: 'turn-0',
      sourceKey: null,
      status: 'completed',
      failure: null,
      error: null,
    };
    expect(goalDecision(goal(), origin)).toEqual({ kind: 'continue' });
    expect(goalDecision(goal({ continuations: 500 }), own('completed'))).toEqual({
      kind: 'continue',
    });
  });

  // What breaks this: a person's message, a routine or a wake ending while a
  // continuation waits, queuing a second one beside it.
  it('changes nothing when a turn that is not the goal’s ends, or the goal is paused', () => {
    for (const status of ['completed', 'failed', 'cancelled'] as const) {
      const other: EndedTurn = {
        id: 'other',
        sourceKey: 'routine:a:b',
        status,
        failure: null,
        error: null,
      };
      expect(goalDecision(goal(), other)).toEqual({ kind: 'skip' });
    }
    const paused = goal({ paused: { reason: 'blocked', note: null, at: new Date() } });
    expect(goalDecision(paused, own('completed'))).toEqual({ kind: 'skip' });
  });

  it('pauses rather than ends when a turn of it was stopped or failed, saying which', () => {
    expect(goalDecision(goal(), own('cancelled'))).toEqual({
      kind: 'pause',
      reason: 'stopped',
      note: null,
    });
    expect(goalDecision(goal(), own('failed', 'usage_limit'))).toMatchObject({
      kind: 'pause',
      reason: 'usage_limit',
      note: 'It broke',
    });
    expect(goalDecision(goal(), own('failed', 'credential'))).toMatchObject({
      reason: 'usage_limit',
    });
    expect(goalDecision(goal(), own('failed', 'loop'))).toMatchObject({ reason: 'blocked' });
    expect(goalDecision(goal(), own('failed', 'refused'))).toMatchObject({ reason: 'failed' });
  });

  // What breaks this: a goal held for its provider's limit pausing once the
  // limit has passed, so the person must resume what could go on by itself.
  it('goes on after a provider limit it was held for, and pauses for one with no known end', () => {
    const held = goal();
    held.hold({ system: 'Anthropic', resetAt: new Date('2026-11-09T12:00:00Z') });
    expect(goalDecision(held, own('failed', 'rate_limit'))).toEqual({ kind: 'continue' });
    expect(goalDecision(held, own('failed', 'usage_limit'))).toEqual({ kind: 'continue' });
    expect(goalDecision(goal(), own('failed', 'usage_limit'))).toMatchObject({
      kind: 'pause',
      reason: 'usage_limit',
    });
  });

  // What breaks this: a long goal pausing every time a deploy restarts the
  // worker or the model goes quiet, when the next continuation would carry on.
  it('goes on after a turn stopped without fault: a silent model, a restarted worker', () => {
    for (const failure of ['stalled', 'interrupted', 'time_limit', 'step_limit'] as const) {
      expect(goalDecision(goal(), own('failed', failure))).toEqual({ kind: 'continue' });
    }
  });

  it('reviews only when the bot claimed the goal met', () => {
    const claimed = goal();
    claimed.claimMet('pnpm test exits 0');
    expect(goalDecision(claimed, own('completed'))).toEqual({ kind: 'review' });
  });

  // What breaks this: a goal whose turns stopped calling tools, or that spent
  // its budget, running on unattended for days.
  it(`pauses after ${BOT_GOAL_IDLE_TURNS} turns in a row with no tool, or a spent budget`, () => {
    const idle = goal();
    for (let i = 0; i < BOT_GOAL_IDLE_TURNS; i++) idle.account({ tokens: 10, calledTools: false });
    expect(goalDecision(idle, own('completed'))).toMatchObject({ reason: 'no_progress' });

    const working = goal();
    working.account({ tokens: 10, calledTools: false });
    working.account({ tokens: 10, calledTools: false });
    working.account({ tokens: 10, calledTools: true });
    expect(working.idleTurns).toBe(0);
    expect(goalDecision(working, own('completed'))).toEqual({ kind: 'continue' });

    const spent = goal({ tokenBudget: 60_000 });
    spent.account({ tokens: 60_000, calledTools: true });
    expect(goalDecision(spent, own('completed'))).toMatchObject({ reason: 'budget' });
  });

  it('ends a goal set with a limit before the change once it runs out', () => {
    expect(goalDecision(goal({ limit: 3, continuations: 3 }), own('completed'))).toEqual({
      kind: 'end',
      activity: 'exhausted',
      reason: null,
    });
  });
});

describe('isDecidedTurn', () => {
  // What breaks this: a turn's end decided twice (its job run again) queuing
  // a second continuation, or the latest turn's end skipped as decided.
  it('is decided only once the goal has counted a later continuation than the turn', () => {
    const origin = { sourceKey: null };
    const second = { sourceKey: goalSourceKey('goal-1', 2) };
    expect(isDecidedTurn(goal({ continuations: 0 }), origin)).toBe(false);
    expect(isDecidedTurn(goal({ continuations: 1 }), origin)).toBe(true);
    expect(isDecidedTurn(goal({ continuations: 2 }), second)).toBe(false);
    expect(isDecidedTurn(goal({ continuations: 3 }), second)).toBe(true);
  });
});

describe('goalOutcome', () => {
  const PROPS = { owner: 'owner-1' };
  const claimed = () => {
    const subject = goal();
    subject.claimMet('CI is green');
    return subject;
  };

  it('ends the goal when the reviewer finds the claim holds', () => {
    expect(goalOutcome(claimed(), { verdict: 'met', reason: 'CI is green' }, PROPS)).toEqual({
      kind: 'end',
      activity: 'met',
      reason: 'CI is green',
    });
  });

  it('pauses it as blocked when the reviewer finds it out of reach without the person', () => {
    expect(goalOutcome(claimed(), { verdict: 'impossible', reason: 'No access' }, PROPS)).toEqual({
      kind: 'pause',
      reason: 'blocked',
      note: 'No access',
    });
  });

  // What breaks this: a goal ending on a claim the reviewer turned down, or
  // the turned-down claim sending the next turn straight back to the reviewer.
  it('goes on with the reason and withdraws the claim while it is not met', () => {
    const subject = claimed();
    expect(goalOutcome(subject, { verdict: 'not_met', reason: 'Two tests fail' }, PROPS)).toEqual({
      kind: 'continue',
      props: PROPS,
      reason: 'Two tests fail',
    });
    expect(subject.claim).toBeNull();
  });

  // What breaks this: a claim made on the turn that spent the budget, or on
  // an old goal's last continuation, sending the goal on past its bounds.
  it('applies the goal’s bounds after turning a claim down', () => {
    const spent = goal({ tokenBudget: 60_000, tokensUsed: 60_000 });
    spent.claimMet('done');
    expect(goalOutcome(spent, { verdict: 'not_met', reason: 'No' }, PROPS)).toMatchObject({
      kind: 'pause',
      reason: 'budget',
    });
    const last = goal({ limit: 3, continuations: 3 });
    last.claimMet('done');
    expect(goalOutcome(last, { verdict: 'not_met', reason: 'No' }, PROPS)).toMatchObject({
      kind: 'end',
      activity: 'exhausted',
    });
  });

  it('takes the bot at its word when the reviewer could not answer', () => {
    expect(goalOutcome(claimed(), null, PROPS)).toEqual({
      kind: 'end',
      activity: 'met',
      reason: 'CI is green',
    });
  });

  // What breaks this: a goal going on for an owner who left the workspace.
  it('stops a goal that would go on when its owner can no longer act', () => {
    expect(goalOutcome(claimed(), { verdict: 'not_met', reason: 'x' }, null)).toEqual({
      kind: 'end',
      activity: 'stopped',
      reason: 'access_lost',
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

  it('sets a goal on the turn for /goal <condition>, with no limit and no budget', () => {
    const set = goalFromMessage('/goal pnpm test exits 0', turn);
    expect(set).toMatchObject({
      objective: 'pnpm test exits 0',
      originTurnId: 'turn-9',
      limit: null,
      tokenBudget: null,
      continuations: 0,
    });
  });

  it('sets nothing for a message that is not /goal', () => {
    expect(goalFromMessage('/release-notes v2', turn)).toBeNull();
    expect(goalFromMessage('what is the goal?', turn)).toBeNull();
  });

  it('sets nothing for /goal alone, /goal clear or /goal resume, which the console runs', () => {
    expect(goalFromMessage('/goal', turn)).toBeNull();
    expect(goalFromMessage('/goal stop', turn)).toBeNull();
    expect(goalFromMessage('/goal resume', turn)).toBeNull();
  });
});

describe('a continuation', () => {
  it('is a goal turn in the background lane, keyed by the goal and its number, opened by a goal line', () => {
    const { turn, opening } = goalContinuationTurn(
      CONTINUATION_PROPS,
      goal({ continuations: 1 }),
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
      limit: null,
      reason: 'Two tests still fail',
    });
    expect(opening.content).toContain('(continuation 2)');
    expect(opening.content).toContain('Two tests still fail');
    expect(opening.content).toContain('end_goal');
  });

  it('says what its budget has spent, when it has one', () => {
    const budgeted = goal({ tokenBudget: 1_000_000, tokensUsed: 250_000 });
    const { opening } = goalContinuationTurn(CONTINUATION_PROPS, budgeted, 2, null);
    expect(opening.content).toContain('250,000 of 1,000,000 tokens');
  });

  // What breaks this: the turn after a restart repeating what the stopped turn already did.
  it('tells the bot its last turn stopped early and its work is kept', () => {
    const { opening } = goalContinuationTurn(CONTINUATION_PROPS, goal(), 2, null, true);
    expect(opening.content).toContain('stopped before it finished');
    expect(opening.content).toContain('before repeating it');
  });
});

describe('BotGoalEntity', () => {
  it('counts continuations up to the limit of a goal set with one, and no further', () => {
    const open = goal({ limit: 3, continuations: 2 });
    expect(open.advance()).toBe(3);
    expect(open.exhausted).toBe(true);
    expect(() => open.advance()).toThrow();
  });

  it('queues no continuation while paused, and runs again once resumed', () => {
    const subject = goal({ idleTurns: 2 });
    subject.pause('failed', 'boom', new Date('2026-11-09T10:00:00Z'));
    expect(() => subject.advance()).toThrow();
    subject.resume();
    expect(subject.paused).toBeNull();
    expect(subject.idleTurns).toBe(0);
    expect(subject.advance()).toBe(1);
  });

  it('refuses an empty objective and a budget under the least one turn needs', () => {
    const base = {
      organizationId: 'org-1',
      botId: 'bot-1',
      originTurnId: 'turn-0',
      credentialScopes: null,
      timeZone: null,
    };
    expect(() => BotGoalEntity.set({ ...base, objective: '  ', tokenBudget: null })).toThrow();
    expect(() => BotGoalEntity.set({ ...base, objective: 'x', tokenBudget: 10 })).toThrow();
    expect(BotGoalEntity.set({ ...base, objective: 'x', tokenBudget: null }).limit).toBeNull();
  });

  it('says how it ended in a line outside any turn, with the reviewer’s reason', () => {
    const line = goalEndLine(goal({ limit: 3, continuations: 3 }), 'exhausted', null);
    expect(line.turnId).toBeNull();
    expect(line.event).toMatchObject({ kind: 'goal', activity: 'exhausted', step: 3, limit: 3 });
    const met = goalEndLine(goal({ continuations: 2 }), 'met', 'CI is green on main');
    expect(met.event).toMatchObject({ activity: 'met', reason: 'CI is green on main' });
    expect(met.content).toContain('CI is green on main');
  });

  it('says why it paused in a line the person and the bot both read', () => {
    const paused = goal();
    paused.pause('blocked', 'I need the deploy key', new Date());
    const line = goalPauseLine(paused, 'paused');
    expect(line.event).toMatchObject({ kind: 'goal', activity: 'paused', reason: 'blocked' });
    expect(line.content).toContain('I need the deploy key');
    expect(goalPauseLine(paused, 'resumed').event).toMatchObject({ activity: 'resumed' });
  });
});

describe('a goal waiting out a rate limit', () => {
  const limit = { system: 'Gmail', resetAt: new Date('2026-11-03T10:02:00.000Z') };

  // What breaks this: a goal set in place of another marked as waiting by
  // the old goal's continuation, so its banner says it waits while it works.
  it('is held only by its own turns: the one that set it and its continuations', () => {
    const subject = goal();
    expect(subject.isHeldBy({ id: 'turn-0', sourceKey: null })).toBe(true);
    expect(subject.isHeldBy({ id: 'turn-2', sourceKey: goalSourceKey('goal-1', 2) })).toBe(true);
    expect(subject.isHeldBy({ id: 'turn-9', sourceKey: goalSourceKey('goal-0', 1) })).toBe(false);
    expect(subject.isHeldBy({ id: 'turn-9', sourceKey: null })).toBe(false);
  });

  // What breaks this: a banner that keeps saying it waits after the next
  // continuation was queued and the bot is working again.
  it('says what it waits for once held, and forgets it when its next continuation is counted', () => {
    const held = goal({ continuations: 1 });
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
