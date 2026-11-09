/**
 * A turn of a goal ended (`25-bots.md` §4.1), with no limit of continuations
 * since 2026-11-09. What breaks this: a goal ending on a failed or stopped
 * turn instead of pausing; a goal going on after the reviewer found the
 * bot's claim met; the reviewer asked after every turn rather than on a
 * claim; a turn's spend or its idleness not counted, so the budget and the
 * no-progress pause never come; a goal ended or replaced while the reviewer
 * answered being continued anyway; a goal going on for an owner who left
 * the workspace. Queuing the continuation itself is the resolver's spec.
 */
import { Some } from 'oxide.ts';
import type { BotGoalResolver } from '../../../application/bot-goal.resolver';
import type { BotGoalReviewResolver } from '../../../application/bot-goal-review.resolver';
import type { BotGoalRepositoryPort } from '../../../database/bot-goal.repository.port';
import type { BotMessageRepositoryPort } from '../../../database/bot-message.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotGoalEntity, type BotGoalProps } from '../../../domain/bot-goal.entity';
import type { BotGoalVerdict } from '../../../domain/bot-goal-review.policy';
import { BotTurnEntity } from '../../../domain/bot-turn.entity';
import { ContinueBotGoalCommand } from '../continue-bot-goal.command';
import { ContinueBotGoalCommandHandler } from '../continue-bot-goal.command-handler';

const PROPS = {
  organizationId: 'org-1',
  botId: 'bot-1',
  requestedByUserId: 'owner-1',
  provider: 'anthropic' as const,
  model: 'claude-sonnet-5-5',
  effort: null,
  timeZone: 'Europe/Madrid',
  credentialScopes: ['bots:read' as const],
};

function goal(props: Partial<BotGoalProps> = {}): BotGoalEntity {
  return BotGoalEntity.create({
    id: 'goal-1',
    props: {
      organizationId: 'org-1',
      botId: 'bot-1',
      originTurnId: 'turn-0',
      objective: 'Get the release branch green',
      limit: null,
      continuations: 1,
      tokensUsed: 0,
      tokenBudget: null,
      idleTurns: 0,
      claim: null,
      paused: null,
      credentialScopes: ['bots:read'],
      timeZone: 'Europe/Madrid',
      ...props,
    },
  });
}

/** A turn of the goal (its continuation `step`) that ended with `status`. */
function ended(
  status: 'completed' | 'failed' | 'cancelled',
  failure: 'usage_limit' | 'rate_limit' | 'stalled' | null = null,
  step = 1,
): BotTurnEntity {
  const turn = BotTurnEntity.queue({ ...PROPS, origin: 'goal', sourceKey: `goal:goal-1:${step}` });
  turn.start(new Date(Date.now() - 60_000));
  turn.end(status, new Date(), {
    error: failure ? 'It stopped' : null,
    failure,
    inputTokens: 1_000,
    outputTokens: 200,
  });
  return turn;
}

function setup(
  stored: BotGoalEntity | null,
  turn: BotTurnEntity,
  options: { owned?: boolean; calledTools?: boolean; verdict?: BotGoalVerdict | null } = {},
) {
  const goals = {
    findForBot: vi.fn<BotGoalRepositoryPort['findForBot']>(async () => stored),
    countTurnSpend: vi.fn<BotGoalRepositoryPort['countTurnSpend']>(async () => true),
  } satisfies Partial<BotGoalRepositoryPort>;
  const reviewer = {
    review: vi.fn<BotGoalReviewResolver['review']>(async () =>
      options.verdict === undefined
        ? { verdict: 'not_met', reason: 'Two checks still fail' }
        : options.verdict,
    ),
  } satisfies Pick<BotGoalReviewResolver, 'review'>;
  const turns = {
    findForRun: vi.fn<BotTurnRepositoryPort['findForRun']>(async () => Some(turn)),
  } satisfies Partial<BotTurnRepositoryPort>;
  const messages = {
    turnCalledTools: vi.fn<BotMessageRepositoryPort['turnCalledTools']>(
      async () => options.calledTools ?? true,
    ),
  } satisfies Partial<BotMessageRepositoryPort>;
  const goalsOf = {
    end: vi.fn<BotGoalResolver['end']>(async () => true),
    pause: vi.fn<BotGoalResolver['pause']>(async () => true),
    queueContinuation: vi.fn<BotGoalResolver['queueContinuation']>(async () => true),
    continuationProps: vi.fn<BotGoalResolver['continuationProps']>(async () =>
      options.owned === false ? null : PROPS,
    ),
  };
  const handler = new ContinueBotGoalCommandHandler(
    turns as unknown as BotTurnRepositoryPort,
    goals as unknown as BotGoalRepositoryPort,
    messages as unknown as BotMessageRepositoryPort,
    goalsOf as unknown as BotGoalResolver,
    reviewer as unknown as BotGoalReviewResolver,
  );
  const run = () => handler.execute(new ContinueBotGoalCommand({ turnId: turn.id }));
  return { goals, goalsOf, reviewer, run };
}

describe('ContinueBotGoalCommandHandler', () => {
  it('queues the next continuation without a review, counting what the turn spent', async () => {
    const stored = goal();
    const turn = ended('completed');
    const { goals, goalsOf, reviewer, run } = setup(stored, turn);
    await run();

    expect(reviewer.review).not.toHaveBeenCalled();
    expect(goals.countTurnSpend).toHaveBeenCalledWith(stored, {
      id: turn.id,
      tokens: 1_200,
      calledTools: true,
    });
    expect(goalsOf.queueContinuation).toHaveBeenCalledWith(
      stored,
      PROPS,
      null,
      false,
      expect.anything(),
    );
  });

  // What breaks this: a deploy restarting the worker, or a silent model,
  // pausing a goal that the next continuation would carry on.
  it('goes on after a turn stopped without fault, telling the next its work is kept', async () => {
    const stored = goal();
    const { goalsOf, run } = setup(stored, ended('failed', 'stalled'));
    await run();
    expect(goalsOf.queueContinuation).toHaveBeenCalledWith(
      stored,
      PROPS,
      null,
      true,
      expect.anything(),
    );
  });

  it('pauses the goal when a turn of it was stopped, or refused for a limit, and queues nothing', async () => {
    for (const [turn, reason] of [
      [ended('cancelled'), 'stopped'],
      [ended('failed', 'usage_limit'), 'usage_limit'],
    ] as const) {
      const stored = goal();
      const { goalsOf, run } = setup(stored, turn);
      await run();
      expect(goalsOf.queueContinuation).not.toHaveBeenCalled();
      expect(goalsOf.end).not.toHaveBeenCalled();
      expect(goalsOf.pause).toHaveBeenCalledWith(stored, reason, turn.error);
    }
  });

  // What breaks this: a goal stopped by its provider's limit waiting for the
  // person to resume it, when the limit's end was known and has passed.
  it('goes on by itself after the provider limit it was held for, saying the last turn stopped early', async () => {
    const held = goal();
    held.hold({ system: 'Anthropic', resetAt: new Date('2026-11-09T12:00:00Z') });
    const { goalsOf, run } = setup(held, ended('failed', 'rate_limit'));
    await run();
    expect(goalsOf.pause).not.toHaveBeenCalled();
    expect(goalsOf.queueContinuation).toHaveBeenCalledWith(
      held,
      PROPS,
      null,
      true,
      expect.anything(),
    );
  });

  it('pauses a goal whose turns stopped calling tools', async () => {
    // The re-read after counting: this turn made it the third without a tool.
    const stored = goal({ idleTurns: 3 });
    const { goalsOf, run } = setup(stored, ended('completed'), { calledTools: false });
    await run();
    expect(goalsOf.pause).toHaveBeenCalledWith(stored, 'no_progress', null);
  });

  it('ends the goal when the reviewer finds the bot’s claim met, and queues nothing', async () => {
    const stored = goal({ claim: 'CI is green' });
    const { goalsOf, reviewer, run } = setup(stored, ended('completed'), {
      verdict: { verdict: 'met', reason: 'Because' },
    });
    await run();

    expect(reviewer.review).toHaveBeenCalledWith(stored, expect.any(String));
    expect(goalsOf.queueContinuation).not.toHaveBeenCalled();
    expect(goalsOf.end).toHaveBeenCalledWith(
      stored,
      expect.objectContaining({ activity: 'met', reason: 'Because' }),
      expect.anything(),
    );
  });

  it('goes on with the reviewer’s reason when the claim does not hold', async () => {
    const stored = goal({ claim: 'CI is green' });
    const { goalsOf, run } = setup(stored, ended('completed'));
    await run();
    expect(goalsOf.queueContinuation).toHaveBeenCalledWith(
      stored,
      PROPS,
      'Two checks still fail',
      false,
      expect.anything(),
    );
    expect(stored.claim).toBeNull();
  });

  // What breaks this: a Stop or a new /goal landing while the reviewer
  // answered, and the old goal queuing a continuation anyway.
  it('leaves the goal alone when it ended or was replaced while the reviewer answered', async () => {
    const { goals, goalsOf, run } = setup(goal({ claim: 'done' }), ended('completed'));
    goals.findForBot
      .mockResolvedValueOnce(goal({ claim: 'done' }))
      .mockResolvedValueOnce(goal({ claim: 'done' }))
      .mockResolvedValueOnce(null);
    await run();
    expect(goalsOf.queueContinuation).not.toHaveBeenCalled();
    expect(goalsOf.end).not.toHaveBeenCalled();
  });

  // What breaks this: the turn in which the bot said blocked, or one whose
  // goal was paused or resumed before its end ran, never counted, so after
  // Resume the budget reads less than was spent. That it counts once is the
  // repository's (`countTurnSpend`; the integration spec runs the orders).
  it('counts a paused goal’s turn and decides nothing else', async () => {
    const turn = ended('completed');
    const paused = goal({ paused: { reason: 'blocked', note: null, at: new Date() } });
    const { goals, goalsOf, run } = setup(paused, turn);
    await run();
    expect(goals.countTurnSpend).toHaveBeenCalledWith(
      paused,
      expect.objectContaining({ id: turn.id }),
    );
    expect(goalsOf.queueContinuation).not.toHaveBeenCalled();
    expect(goalsOf.pause).not.toHaveBeenCalled();
  });

  it('does nothing for a bot with no goal', async () => {
    const { goals, goalsOf, run } = setup(null, ended('completed'));
    await run();
    expect(goals.countTurnSpend).not.toHaveBeenCalled();
    expect(goalsOf.queueContinuation).not.toHaveBeenCalled();
    expect(goalsOf.pause).not.toHaveBeenCalled();
  });

  // What breaks this: the job for one turn's end run twice (a worker that
  // died mid-job, a redelivery) counting the turn twice and queuing a second
  // continuation beside the first, since the goal it reads has moved on.
  it('decides nothing for a turn whose end was already decided, but offers its spend', async () => {
    const movedOn = goal({ continuations: 2, tokensUsed: 1_200 });
    const { goals, goalsOf, run } = setup(movedOn, ended('completed', null, 1));
    await run();
    // Counted already, the repository refuses it; resumed past it, it counts it now.
    expect(goals.countTurnSpend).toHaveBeenCalledTimes(1);
    expect(goalsOf.queueContinuation).not.toHaveBeenCalled();
    expect(goalsOf.pause).not.toHaveBeenCalled();
  });

  it('stops the goal when its owner can no longer act in the workspace', async () => {
    const stored = goal();
    const { goalsOf, run } = setup(stored, ended('completed'), { owned: false });
    await run();

    expect(goalsOf.queueContinuation).not.toHaveBeenCalled();
    expect(goalsOf.end).toHaveBeenCalledWith(
      stored,
      expect.objectContaining({ activity: 'stopped', reason: 'access_lost' }),
      expect.anything(),
    );
  });
});
