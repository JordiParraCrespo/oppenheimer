/**
 * A turn of a bot with a goal ended (`25-bots.md` §4.1). What breaks this: a
 * continuation queued while another already waits (two would run); the count
 * stored when nothing was queued, which spends the limit on nothing; a goal
 * past its limit or a failed goal turn queuing one more; a goal going on for
 * an owner who lost the workspace.
 */
import { emptyScope } from '@oppenheimer/backend-authz';
import { Some } from 'oxide.ts';
import type { BotEntity } from '../../../../bots/domain/bot.entity';
import type { BotModelAccessResolver } from '../../../application/bot-model-access.resolver';
import type { BotOwnerScopeResolver } from '../../../application/bot-owner-scope.resolver';
import type { BotGoalRepositoryPort } from '../../../database/bot-goal.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotGoalEntity } from '../../../domain/bot-goal.entity';
import { BotTurnEntity } from '../../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { ContinueBotGoalCommand } from '../continue-bot-goal.command';
import { ContinueBotGoalCommandHandler } from '../continue-bot-goal.command-handler';

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
      credentialScopes: ['bots:read', 'bots:write'],
      timeZone: 'Europe/Madrid',
    },
  });
}

function ended(
  status: 'completed' | 'failed' | 'cancelled',
  sourceKey: string | null = null,
): BotTurnEntity {
  const turn = BotTurnEntity.queue({
    organizationId: 'org-1',
    botId: 'bot-1',
    requestedByUserId: 'owner-1',
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: null,
    sourceKey,
  });
  turn.end(status, new Date());
  return turn;
}

function setup(stored: BotGoalEntity | null, turn: BotTurnEntity, owned = true) {
  const goals = {
    findForBot: vi.fn<BotGoalRepositoryPort['findForBot']>(async () => stored),
    advance: vi.fn<BotGoalRepositoryPort['advance']>(async () => true),
    end: vi.fn<BotGoalRepositoryPort['end']>(async () => true),
  } satisfies Partial<BotGoalRepositoryPort>;
  const turns = {
    findForRun: vi.fn<BotTurnRepositoryPort['findForRun']>(async () => Some(turn)),
    enqueueOnce: vi.fn<BotTurnRepositoryPort['enqueueOnce']>(async (queued) => ({
      outcome: 'staged',
      turnId: queued.id,
    })),
  } satisfies Partial<BotTurnRepositoryPort>;
  const stream = { publish: vi.fn<BotStreamPort['publish']>(async () => undefined) };
  const bot = {
    id: 'bot-1',
    createdByUserId: 'owner-1',
    provider: 'anthropic',
    model: null,
    effort: null,
  } as unknown as BotEntity;
  const handler = new ContinueBotGoalCommandHandler(
    turns as unknown as BotTurnRepositoryPort,
    goals as unknown as BotGoalRepositoryPort,
    stream,
    { findBot: async () => bot } as unknown as BotModelAccessResolver,
    {
      resolve: async () => (owned ? emptyScope('owner-1', 'org-1') : null),
    } as unknown as BotOwnerScopeResolver,
  );
  const run = () => handler.execute(new ContinueBotGoalCommand({ turnId: turn.id }));
  return { goals, turns, stream, run };
}

describe('ContinueBotGoalCommandHandler', () => {
  it('queues the next continuation as the owner, with the goal’s reach, and stores the count', async () => {
    const { goals, turns, stream, run } = setup(goal(1), ended('completed'));
    await run();

    const [turn, opening, , busyPrefix] = turns.enqueueOnce.mock.calls[0];
    expect(turn).toMatchObject({
      origin: 'goal',
      sourceKey: 'goal:goal-1:2',
      requestedByUserId: 'owner-1',
      credentialScopes: ['bots:read', 'bots:write'],
      timeZone: 'Europe/Madrid',
    });
    expect(busyPrefix).toBe('goal:goal-1:');
    expect(opening.event).toMatchObject({ kind: 'goal', activity: 'continued', step: 2 });
    expect(goals.advance).toHaveBeenCalledWith(expect.objectContaining({ continuations: 2 }));
    expect(stream.publish).toHaveBeenCalledWith('bot-1', {
      type: 'turn',
      turnId: turn.id,
      status: 'queued',
    });
  });

  it('queues nothing and stores nothing while a continuation already waits', async () => {
    const { goals, turns, run } = setup(goal(1), ended('completed'));
    turns.enqueueOnce.mockResolvedValueOnce({ outcome: 'busy', turnId: 'waiting' });
    await run();

    expect(goals.advance).not.toHaveBeenCalled();
    expect(goals.end).not.toHaveBeenCalled();
  });

  it('ends the goal exhausted, with its line, once its continuations are spent', async () => {
    const { goals, turns, stream, run } = setup(goal(3, 3), ended('completed'));
    await run();

    expect(turns.enqueueOnce).not.toHaveBeenCalled();
    const [, line] = goals.end.mock.calls[0];
    expect(line?.event).toMatchObject({ kind: 'goal', activity: 'exhausted', step: 3 });
    expect(stream.publish).toHaveBeenCalledWith('bot-1', {
      type: 'message',
      turnId: null,
      messageId: line?.id,
    });
  });

  it('stops the goal when its own continuation was stopped, and queues nothing', async () => {
    const { goals, turns, run } = setup(goal(1), ended('cancelled', 'goal:goal-1:1'));
    await run();

    expect(turns.enqueueOnce).not.toHaveBeenCalled();
    expect(goals.end.mock.calls[0][1]?.event).toMatchObject({
      activity: 'stopped',
      reason: 'cancelled',
    });
  });

  it('stops the goal when its owner can no longer act in the workspace', async () => {
    const { goals, turns, run } = setup(goal(1), ended('completed'), false);
    await run();

    expect(turns.enqueueOnce).not.toHaveBeenCalled();
    expect(goals.end.mock.calls[0][1]?.event).toMatchObject({
      activity: 'stopped',
      reason: 'access_lost',
    });
  });

  it('does nothing for a bot with no goal', async () => {
    const { goals, turns, run } = setup(null, ended('completed'));
    await run();

    expect(turns.enqueueOnce).not.toHaveBeenCalled();
    expect(goals.end).not.toHaveBeenCalled();
  });
});
