/**
 * Every end of a goal (`25-bots.md` §4.1). What breaks this: an end that
 * leaves the goal's continuation waiting, so the bot carries on with work
 * it, or its owner, just stopped; an end said twice; a continuation run as
 * someone the workspace no longer has.
 */
import type { BotEntity } from '../../../bots/domain/bot.entity';
import type { BotGoalRepositoryPort } from '../../database/bot-goal.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { BotGoalEntity } from '../../domain/bot-goal.entity';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { BotGoalResolver } from '../bot-goal.resolver';
import type { BotModelAccessResolver } from '../bot-model-access.resolver';
import type { BotOwnerScopeResolver } from '../bot-owner-scope.resolver';

function open(): BotGoalEntity {
  return BotGoalEntity.set({
    organizationId: 'org-1',
    botId: 'bot-1',
    originTurnId: 'turn-0',
    objective: 'Triage the bugs',
    limit: 3,
    credentialScopes: ['bots:read'],
    timeZone: 'Europe/Madrid',
  });
}

function setup(options: { ended?: boolean; owner?: boolean } = {}) {
  const waiting = BotTurnEntity.queue({
    organizationId: 'org-1',
    botId: 'bot-1',
    requestedByUserId: 'owner-1',
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: null,
    origin: 'goal',
    sourceKey: 'goal:goal-1:2',
  });
  const goals = {
    end: vi.fn<BotGoalRepositoryPort['end']>(async () => options.ended ?? true),
  } satisfies Partial<BotGoalRepositoryPort>;
  const turns = {
    findQueuedBySourcePrefix: vi.fn<BotTurnRepositoryPort['findQueuedBySourcePrefix']>(async () => [
      waiting,
    ]),
    finish: vi.fn<BotTurnRepositoryPort['finish']>(async () => true),
  } satisfies Partial<BotTurnRepositoryPort>;
  const stream = { publish: vi.fn<BotStreamPort['publish']>(async () => undefined) };
  const bot = {
    id: 'bot-1',
    createdByUserId: 'owner-1',
    provider: 'glm',
    model: null,
    effort: null,
  };
  const resolver = new BotGoalResolver(
    goals as unknown as BotGoalRepositoryPort,
    turns as unknown as BotTurnRepositoryPort,
    stream,
    { findBot: async () => bot as unknown as BotEntity } as unknown as BotModelAccessResolver,
    {
      resolve: async () => (options.owner === false ? null : {}),
    } as unknown as BotOwnerScopeResolver,
  );
  return { goals, turns, stream, waiting, resolver };
}

describe('BotGoalResolver', () => {
  it('ends a goal with its line and cancels the continuation it left waiting', async () => {
    const goal = open();
    const { goals, turns, stream, waiting, resolver } = setup();
    expect(await resolver.end(goal, { activity: 'cleared', reason: null }, 'c-1')).toBe(true);

    expect(goals.end.mock.calls[0][1]?.event).toMatchObject({ kind: 'goal', activity: 'cleared' });
    expect(turns.findQueuedBySourcePrefix).toHaveBeenCalledWith(
      'org-1',
      'bot-1',
      `goal:${goal.id}:`,
    );
    expect(waiting.status).toBe('cancelled');
    expect(turns.finish).toHaveBeenCalledWith(waiting, 'c-1');
    expect(stream.publish).toHaveBeenCalledWith('bot-1', {
      type: 'turn',
      turnId: waiting.id,
      status: 'cancelled',
    });
  });

  it('writes no line when the call that ended it is the record, and still cancels what waits', async () => {
    const { goals, turns, resolver } = setup();
    await resolver.end(open(), null, null);
    expect(goals.end.mock.calls[0][1]).toBeNull();
    expect(turns.finish).toHaveBeenCalled();
  });

  it('does nothing more for a goal that had already ended', async () => {
    const { turns, stream, resolver } = setup({ ended: false });
    expect(await resolver.end(open(), { activity: 'cleared', reason: null }, null)).toBe(false);
    expect(turns.findQueuedBySourcePrefix).not.toHaveBeenCalled();
    expect(stream.publish).not.toHaveBeenCalled();
  });

  it('continues as the owner on the bot’s engine with the goal’s reach, or not at all without one', async () => {
    expect(await setup().resolver.continuationProps(open())).toMatchObject({
      requestedByUserId: 'owner-1',
      provider: 'glm',
      credentialScopes: ['bots:read'],
      timeZone: 'Europe/Madrid',
    });
    expect(await setup({ owner: false }).resolver.continuationProps(open())).toBeNull();
  });
});
