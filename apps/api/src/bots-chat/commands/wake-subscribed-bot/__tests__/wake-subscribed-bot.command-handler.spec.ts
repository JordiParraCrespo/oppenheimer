/**
 * A session a bot follows moved, and the bot is woken at most once for it
 * (`27-bot-subscriptions.md` §4): the session read again as the owner, a
 * turn queued under a key the same news always gives, the wake recorded
 * after it, and a subscription that has nothing left to follow, or whose
 * owner can no longer read the session, ended without a wake. The decision
 * table is `bot-subscription.policy.spec.ts`; that a duplicate key queues one
 * turn in Postgres is the integration suite's.
 */
import type { QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { BotEntity } from '../../../../bots/domain/bot.entity';
import { SessionErrors } from '../../../../sessions/domain/sessions.errors';
import type { WorkSessionEntity } from '../../../../sessions/domain/work-session.entity';
import { FindSessionQuery } from '../../../../sessions/queries/find-session/find-session.query';
import type { BotModelAccessResolver } from '../../../application/bot-model-access.resolver';
import type { BotOwnerScopeResolver } from '../../../application/bot-owner-scope.resolver';
import { BotSessionWakeResolver } from '../../../application/bot-session-wake.resolver';
import type { BotSessionWatchResolver } from '../../../application/bot-session-watch.resolver';
import { BotSubscriptionSubjectResolver } from '../../../application/bot-subscription-subject.resolver';
import { BotSubscriptionMapper } from '../../../bot-subscription.mapper';
import type { BotSubscriptionRepositoryPort } from '../../../database/bot-subscription.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import {
  BotSubscriptionEntity,
  type BotSubscriptionProps,
} from '../../../domain/bot-subscription.entity';
import { BOT_SUBSCRIPTION_WAKE_LIMIT } from '../../../domain/bot-subscription.policy';
import type { BotTurnEntity } from '../../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { WakeSubscribedBotCommand } from '../wake-subscribed-bot.command';
import { WakeSubscribedBotCommandHandler } from '../wake-subscribed-bot.command-handler';

const owner = emptyScope('owner-1', 'org-1');

function subscription(overrides: Partial<BotSubscriptionProps> = {}): BotSubscriptionEntity {
  return BotSubscriptionEntity.create({
    id: 'sub-1',
    props: {
      organizationId: 'org-1',
      botId: 'bot-1',
      resourceKind: 'session',
      resourceId: 'session-1',
      originTurnId: 'turn-0',
      purpose: 'research Cursor skills',
      until: 'task',
      watchedTurn: 1,
      credentialScopes: null,
      timeZone: 'Europe/Madrid',
      lastTurn: null,
      lastState: null,
      wakes: 0,
      version: 1,
      ...overrides,
    },
  });
}

function session(state: string, overrides: { isResolved?: boolean; seq?: number } = {}) {
  return {
    id: 'session-1',
    name: 'Cursor skills research',
    isResolved: overrides.isResolved ?? false,
    latestTurn: {
      seq: overrides.seq ?? 1,
      state,
      prompt: 'Find the skills',
      result: state === 'completed' ? 'Found 12' : null,
      failureDetail: null,
    },
  } as unknown as WorkSessionEntity;
}

function setup(options: {
  stored?: BotSubscriptionEntity | null;
  read?: WorkSessionEntity | Error;
  owner?: typeof owner | null;
  bot?: Partial<BotEntity> | null;
  queued?: 'staged' | 'waiting' | 'existing' | 'missing';
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
  const bot =
    options.bot !== undefined
      ? options.bot
      : {
          id: 'bot-1',
          createdByUserId: 'owner-1',
          provider: 'anthropic',
          model: 'claude-sonnet-5-5',
          effort: null,
        };
  const access = {
    findBot: vi.fn<BotModelAccessResolver['findBot']>(async () => bot as BotEntity | null),
  };
  const owners = {
    resolve: vi.fn(async () => (options.owner === undefined ? owner : options.owner)),
  };
  const queries = {
    execute: vi.fn(async (query: unknown) => {
      expect(query).toBeInstanceOf(FindSessionQuery);
      const read = options.read ?? session('completed');
      if (read instanceof Error) throw read;
      return read;
    }),
  };
  const watches = { release: vi.fn(async () => undefined) };
  const handler = new WakeSubscribedBotCommandHandler(
    subscriptions as unknown as BotSubscriptionRepositoryPort,
    new BotSubscriptionSubjectResolver(
      access as unknown as BotModelAccessResolver,
      owners as unknown as BotOwnerScopeResolver,
      queries as unknown as QueryBus,
    ),
    new BotSubscriptionMapper(),
    new BotSessionWakeResolver(
      subscriptions as unknown as BotSubscriptionRepositoryPort,
      turns as unknown as BotTurnRepositoryPort,
      stream,
      new BotSubscriptionMapper(),
      watches as unknown as BotSessionWatchResolver,
    ),
  );
  const run = () => handler.execute(new WakeSubscribedBotCommand({ subscriptionId: 'sub-1' }));
  return { subscriptions, turns, stream, queries, owners, watches, run };
}

describe('WakeSubscribedBotCommandHandler', () => {
  it('reads the session as the owner and queues one turn of the bot, keyed by the task and its state', async () => {
    const { turns, stream, queries, subscriptions, run } = setup({});
    await run();
    expect(queries.execute.mock.calls[0][0]).toMatchObject({
      scope: owner,
      sessionId: 'session-1',
    });
    const [turn, opening] = turns.enqueueOnce.mock.calls[0];
    expect(turn).toMatchObject({
      botId: 'bot-1',
      requestedByUserId: 'owner-1',
      origin: 'subscription',
      lane: 'background',
      sourceKey: 'subscription:sub-1:1:completed',
      timeZone: 'Europe/Madrid',
    });
    expect(opening.event).toMatchObject({ kind: 'session', state: 'completed', turn: 1 });
    expect(stream.publish).toHaveBeenCalledWith('bot-1', {
      type: 'turn',
      turnId: (turn as BotTurnEntity).id,
      status: 'queued',
    });
    // The task it followed ended: the subscription goes with this wake.
    expect(subscriptions.end).toHaveBeenCalledTimes(1);
    expect(subscriptions.recordWake).not.toHaveBeenCalled();
  });

  // What breaks this: a redelivered event telling the person twice. The
  // queue answers the turn it already holds, and nothing is published again.
  it('queues nothing new and publishes nothing when the same news is delivered again', async () => {
    const { stream, subscriptions, run } = setup({ queued: 'existing' });
    await run();
    expect(stream.publish).not.toHaveBeenCalled();
    expect(subscriptions.end).toHaveBeenCalledTimes(1);
  });

  it('records a wake for input needed and keeps following the task', async () => {
    const { subscriptions, turns, run } = setup({ read: session('requires_action') });
    await run();
    expect(turns.enqueueOnce.mock.calls[0][0].sourceKey).toBe(
      'subscription:sub-1:1:requires_action',
    );
    const recorded = subscriptions.recordWake.mock.calls[0][0];
    expect(recorded).toMatchObject({ lastTurn: 1, lastState: 'requires_action', wakes: 1 });
    expect(subscriptions.end).not.toHaveBeenCalled();
  });

  // What breaks this: an event delivered late, after the task already
  // ended, waking the bot for an input the agent no longer waits on.
  it('wakes for the state the session is in now, not the one the event announced', async () => {
    const stale = subscription({ lastTurn: 1, lastState: 'requires_action', wakes: 1 });
    const { turns, run } = setup({ stored: stale, read: session('completed') });
    await run();
    expect(turns.enqueueOnce.mock.calls[0][0].sourceKey).toBe('subscription:sub-1:1:completed');

    const told = subscription({ lastTurn: 1, lastState: 'requires_action', wakes: 1 });
    const again = setup({ stored: told, read: session('requires_action') });
    await again.run();
    expect(again.turns.enqueueOnce).not.toHaveBeenCalled();
    expect(again.subscriptions.recordWake).not.toHaveBeenCalled();
  });

  it('does nothing while the agent is still working', async () => {
    const { turns, subscriptions, run } = setup({ read: session('in_progress') });
    await run();
    expect(turns.enqueueOnce).not.toHaveBeenCalled();
    expect(subscriptions.end).not.toHaveBeenCalled();
  });

  it('does nothing for a subscription already ended', async () => {
    const { queries, turns, run } = setup({ stored: null });
    await run();
    expect(queries.execute).not.toHaveBeenCalled();
    expect(turns.enqueueOnce).not.toHaveBeenCalled();
  });

  // What breaks this: a bot reading a session its owner was removed from,
  // because the event, not the owner's access, decided the wake.
  it('ends without a wake when the owner can no longer read the session, or has left', async () => {
    const refused = setup({ read: new AppError(SessionErrors.NOT_FOUND) });
    await refused.run();
    expect(refused.turns.enqueueOnce).not.toHaveBeenCalled();
    expect(refused.subscriptions.end).toHaveBeenCalledTimes(1);

    const left = setup({ owner: null });
    await left.run();
    expect(left.queries.execute).not.toHaveBeenCalled();
    expect(left.turns.enqueueOnce).not.toHaveBeenCalled();
    expect(left.subscriptions.end).toHaveBeenCalledTimes(1);

    const gone = setup({ bot: null });
    await gone.run();
    expect(gone.turns.enqueueOnce).not.toHaveBeenCalled();
    expect(gone.subscriptions.end).toHaveBeenCalledTimes(1);
  });

  // What breaks this: a database blip read as "the owner lost access", which
  // would end the subscription for good.
  it('throws on a fault reading the session, ending nothing, for the outbox to retry', async () => {
    const { subscriptions, turns, run } = setup({ read: new Error('connection reset') });
    await expect(run()).rejects.toThrow('connection reset');
    expect(subscriptions.end).not.toHaveBeenCalled();
    expect(turns.enqueueOnce).not.toHaveBeenCalled();
  });

  it('ends at the wake limit, and when the session closed with nothing new to tell', async () => {
    const spent = setup({
      stored: subscription({
        until: 'closed',
        watchedTurn: null,
        wakes: BOT_SUBSCRIPTION_WAKE_LIMIT,
      }),
      read: session('completed', { seq: 9 }),
    });
    await spent.run();
    expect(spent.turns.enqueueOnce).not.toHaveBeenCalled();
    expect(spent.subscriptions.end).toHaveBeenCalledTimes(1);

    const closed = setup({
      stored: subscription({ lastTurn: 1, lastState: 'completed', wakes: 1 }),
      read: session('completed', { isResolved: true }),
    });
    await closed.run();
    expect(closed.turns.enqueueOnce).not.toHaveBeenCalled();
    expect(closed.subscriptions.end).toHaveBeenCalledTimes(1);
  });
});
