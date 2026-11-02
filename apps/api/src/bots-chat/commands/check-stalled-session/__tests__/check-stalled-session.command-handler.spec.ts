/**
 * The silent stall check a few minutes after a bot hands a session a task
 * (`27-bot-subscriptions.md` §4.1): the session read again as the owner, the
 * bot woken once, keyed by the task, only when it is stuck short of every
 * state that wakes it, and the subscription left as it was so the task's end
 * still wakes the bot. The decision table is `bot-subscription.policy.spec.ts`.
 */
import type { QueryBus } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { emptyScope } from '../../../../authz/domain/access-scope.types';
import type { BotEntity } from '../../../../bots/domain/bot.entity';
import { SessionErrors } from '../../../../sessions/domain/sessions.errors';
import type { WorkSessionEntity } from '../../../../sessions/domain/work-session.entity';
import type { BotModelAccessResolver } from '../../../application/bot-model-access.resolver';
import type { BotOwnerScopeResolver } from '../../../application/bot-owner-scope.resolver';
import { BotSubscriptionSubjectResolver } from '../../../application/bot-subscription-subject.resolver';
import { BotSubscriptionMapper } from '../../../bot-subscription.mapper';
import type { BotSubscriptionRepositoryPort } from '../../../database/bot-subscription.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotSubscriptionEntity } from '../../../domain/bot-subscription.entity';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { CheckStalledSessionCommand } from '../check-stalled-session.command';
import { CheckStalledSessionCommandHandler } from '../check-stalled-session.command-handler';

const owner = emptyScope('owner-1', 'org-1');

function subscription(): BotSubscriptionEntity {
  return BotSubscriptionEntity.create({
    id: 'sub-1',
    props: {
      organizationId: 'org-1',
      botId: 'bot-1',
      resourceKind: 'session',
      resourceId: 'session-1',
      originTurnId: 'turn-0',
      purpose: null,
      until: 'task',
      watchedTurn: 1,
      credentialScopes: null,
      timeZone: 'Europe/Madrid',
      lastTurn: null,
      lastState: null,
      wakes: 0,
      terminalWatch: null,
      matches: 0,
      version: 1,
    },
  });
}

function session(state: string, observedWorking: boolean) {
  return {
    id: 'session-1',
    name: 'Bot ordering',
    isResolved: false,
    place: 'host',
    latestTurn: {
      seq: 1,
      state,
      observedWorking,
      drive: 'interactive',
      prompt: 'Make bots reorderable',
      result: null,
      failureDetail: null,
    },
  } as unknown as WorkSessionEntity;
}

function setup(options: {
  stored?: BotSubscriptionEntity | null;
  read?: WorkSessionEntity | Error;
  queued?: 'staged' | 'existing';
}) {
  const stored = options.stored === undefined ? subscription() : options.stored;
  const subscriptions = {
    findForWake: vi.fn<BotSubscriptionRepositoryPort['findForWake']>(async () => stored),
    recordWake: vi.fn<BotSubscriptionRepositoryPort['recordWake']>(async () => true),
    end: vi.fn<BotSubscriptionRepositoryPort['end']>(async () => true),
  } satisfies Partial<BotSubscriptionRepositoryPort>;
  const turns = {
    enqueueOnce: vi.fn<BotTurnRepositoryPort['enqueueOnce']>(async (turn) => ({
      outcome: options.queued ?? 'staged',
      turnId: turn.id,
    })),
  } satisfies Partial<BotTurnRepositoryPort>;
  const stream = { publish: vi.fn<BotStreamPort['publish']>(async () => undefined) };
  const bot = {
    id: 'bot-1',
    createdByUserId: 'owner-1',
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: null,
  };
  const access = {
    findBot: vi.fn<BotModelAccessResolver['findBot']>(async () => bot as unknown as BotEntity),
  };
  const owners = { resolve: vi.fn(async () => owner) };
  const queries = {
    execute: vi.fn(async () => {
      const read = options.read ?? session('queued', false);
      if (read instanceof Error) throw read;
      return read;
    }),
  };
  const handler = new CheckStalledSessionCommandHandler(
    subscriptions as unknown as BotSubscriptionRepositoryPort,
    turns as unknown as BotTurnRepositoryPort,
    stream,
    new BotSubscriptionSubjectResolver(
      access as unknown as BotModelAccessResolver,
      owners as unknown as BotOwnerScopeResolver,
      queries as unknown as QueryBus,
    ),
    new BotSubscriptionMapper(),
  );
  const run = () =>
    handler.execute(new CheckStalledSessionCommand({ subscriptionId: 'sub-1', turn: 1 }));
  return { subscriptions, turns, stream, queries, run };
}

describe('CheckStalledSessionCommandHandler', () => {
  it('wakes the bot once, keyed by the task, when the task it handed off never started', async () => {
    const { turns, stream, subscriptions, run } = setup({});
    await run();
    const [turn, opening] = turns.enqueueOnce.mock.calls[0];
    expect(turn).toMatchObject({
      origin: 'subscription',
      lane: 'background',
      sourceKey: 'subscription:sub-1:1:stalled',
    });
    expect(opening.event).toMatchObject({ kind: 'session', state: 'stalled', turn: 1 });
    expect(opening.content).toContain('looks stuck: it has not started');
    expect(stream.publish).toHaveBeenCalledTimes(1);
    // The task's own end still wakes the bot: the check records nothing.
    expect(subscriptions.recordWake).not.toHaveBeenCalled();
    expect(subscriptions.end).not.toHaveBeenCalled();
  });

  it('wakes the bot when the agent started and was never seen working', async () => {
    const { turns, run } = setup({ read: session('in_progress', false) });
    await run();
    expect(turns.enqueueOnce.mock.calls[0][1].content).toContain(
      'its agent has not been seen working',
    );
  });

  // What breaks this: the check posting "still running" for every task.
  it('stays silent for an agent seen working', async () => {
    const { turns, stream, run } = setup({ read: session('in_progress', true) });
    await run();
    expect(turns.enqueueOnce).not.toHaveBeenCalled();
    expect(stream.publish).not.toHaveBeenCalled();
  });

  it('publishes nothing when a retried job finds its wake already queued', async () => {
    const { stream, run } = setup({ queued: 'existing' });
    await run();
    expect(stream.publish).not.toHaveBeenCalled();
  });

  it('stays silent, ending nothing, for a subscription gone or a session the owner cannot read', async () => {
    const gone = setup({ stored: null });
    await gone.run();
    expect(gone.queries.execute).not.toHaveBeenCalled();
    expect(gone.turns.enqueueOnce).not.toHaveBeenCalled();

    const refused = setup({ read: new AppError(SessionErrors.NOT_FOUND) });
    await refused.run();
    expect(refused.turns.enqueueOnce).not.toHaveBeenCalled();
    expect(refused.subscriptions.end).not.toHaveBeenCalled();
  });

  it('throws on a fault reading the session, for the queue to retry', async () => {
    const { turns, run } = setup({ read: new Error('connection reset') });
    await expect(run()).rejects.toThrow('connection reset');
    expect(turns.enqueueOnce).not.toHaveBeenCalled();
  });
});
