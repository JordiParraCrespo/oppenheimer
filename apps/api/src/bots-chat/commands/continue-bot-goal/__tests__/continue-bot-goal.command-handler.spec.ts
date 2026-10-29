/**
 * A turn of a goal ended (`25-bots.md` §4.1). What breaks this: a goal past
 * its limit, or one whose turn failed, queuing one more; a goal going on for
 * an owner who left the workspace; a continuation counted apart from the turn
 * it queues (the repository claims both at once: `enqueueContinuation`).
 */
import { Some } from 'oxide.ts';
import type { BotGoalResolver } from '../../../application/bot-goal.resolver';
import type { BotGoalRepositoryPort } from '../../../database/bot-goal.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotGoalEntity } from '../../../domain/bot-goal.entity';
import { BotTurnEntity } from '../../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
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

function goal(continuations = 1, limit = 3): BotGoalEntity {
  return BotGoalEntity.create({
    id: 'goal-1',
    props: {
      organizationId: 'org-1',
      botId: 'bot-1',
      originTurnId: 'turn-0',
      objective: 'Get the release branch green',
      limit,
      continuations,
      credentialScopes: ['bots:read'],
      timeZone: 'Europe/Madrid',
    },
  });
}

/** A turn of the goal (its continuation `step`) that ended with `status`. */
function ended(status: 'completed' | 'failed' | 'cancelled', step = 1): BotTurnEntity {
  const turn = BotTurnEntity.queue({ ...PROPS, origin: 'goal', sourceKey: `goal:goal-1:${step}` });
  turn.end(status, new Date());
  return turn;
}

function setup(stored: BotGoalEntity | null, turn: BotTurnEntity, owned = true) {
  const goals = {
    findForBot: vi.fn<BotGoalRepositoryPort['findForBot']>(async () => stored),
  } satisfies Partial<BotGoalRepositoryPort>;
  const turns = {
    findForRun: vi.fn<BotTurnRepositoryPort['findForRun']>(async () => Some(turn)),
    enqueueContinuation: vi.fn<BotTurnRepositoryPort['enqueueContinuation']>(async () => 'staged'),
  } satisfies Partial<BotTurnRepositoryPort>;
  const stream = { publish: vi.fn<BotStreamPort['publish']>(async () => undefined) };
  const goalsOf = {
    end: vi.fn<BotGoalResolver['end']>(async () => true),
    continuationProps: vi.fn<BotGoalResolver['continuationProps']>(async () =>
      owned ? PROPS : null,
    ),
  };
  const handler = new ContinueBotGoalCommandHandler(
    turns as unknown as BotTurnRepositoryPort,
    goals as unknown as BotGoalRepositoryPort,
    stream,
    goalsOf as unknown as BotGoalResolver,
  );
  const run = () => handler.execute(new ContinueBotGoalCommand({ turnId: turn.id }));
  return { goals, turns, stream, goalsOf, run };
}

describe('ContinueBotGoalCommandHandler', () => {
  it('queues the next continuation as the owner, claiming its count with it', async () => {
    const stored = goal(1);
    const { turns, stream, run } = setup(stored, ended('completed'));
    await run();

    const [turn, opening, , claimed] = turns.enqueueContinuation.mock.calls[0];
    expect(turn).toMatchObject({
      origin: 'goal',
      sourceKey: 'goal:goal-1:2',
      requestedByUserId: 'owner-1',
      credentialScopes: ['bots:read'],
      timeZone: 'Europe/Madrid',
    });
    expect(opening.event).toMatchObject({ kind: 'goal', activity: 'continued', step: 2 });
    expect(claimed).toBe(stored);
    expect(stream.publish).toHaveBeenCalledWith('bot-1', {
      type: 'turn',
      turnId: turn.id,
      status: 'queued',
    });
  });

  // What breaks this: a Stop that won the race still announced as a queued turn.
  it('says nothing when the goal was stopped or claimed first, and queues nothing', async () => {
    const { turns, stream, run } = setup(goal(1), ended('completed'));
    turns.enqueueContinuation.mockResolvedValueOnce('lost');
    await run();
    expect(stream.publish).not.toHaveBeenCalled();
  });

  it('ends the goal exhausted once its continuations are spent', async () => {
    const stored = goal(3, 3);
    const { turns, goalsOf, run } = setup(stored, ended('completed', 3));
    await run();

    expect(turns.enqueueContinuation).not.toHaveBeenCalled();
    expect(goalsOf.end).toHaveBeenCalledWith(
      stored,
      { activity: 'exhausted', reason: null },
      expect.anything(),
    );
  });

  it('stops the goal when its own continuation was stopped, and queues nothing', async () => {
    const stored = goal(1);
    const { turns, goalsOf, run } = setup(stored, ended('cancelled'));
    await run();

    expect(turns.enqueueContinuation).not.toHaveBeenCalled();
    expect(goalsOf.end).toHaveBeenCalledWith(
      stored,
      { activity: 'stopped', reason: 'cancelled' },
      expect.anything(),
    );
  });

  it('stops the goal when its owner can no longer act in the workspace', async () => {
    const stored = goal(1);
    const { turns, goalsOf, run } = setup(stored, ended('completed'), false);
    await run();

    expect(turns.enqueueContinuation).not.toHaveBeenCalled();
    expect(goalsOf.end).toHaveBeenCalledWith(
      stored,
      { activity: 'stopped', reason: 'access_lost' },
      expect.anything(),
    );
  });

  it('does nothing for a bot with no goal', async () => {
    const { turns, goalsOf, run } = setup(null, ended('completed'));
    await run();

    expect(turns.enqueueContinuation).not.toHaveBeenCalled();
    expect(goalsOf.end).not.toHaveBeenCalled();
  });
});
