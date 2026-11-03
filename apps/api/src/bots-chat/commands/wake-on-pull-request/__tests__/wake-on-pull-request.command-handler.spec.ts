/**
 * An event on a pull request a bot follows wakes it (`27-bot-subscriptions.md`
 * §7). What breaks this: an event delivered twice queuing two turns or
 * counting twice against the wake limit; a wake queued without taking one
 * from the limit; a merged pull request keeping its
 * subscription; a bot whose owner left being woken; a wake past the limit;
 * a session subscription woken by a pull request's event. The text the bot
 * reads is `bot-pull-request-wake.policy.spec.ts`.
 */
import type { QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import type { BotEntity } from '../../../../bots/domain/bot.entity';
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
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { WakeOnPullRequestCommand } from '../wake-on-pull-request.command';
import { WakeOnPullRequestCommandHandler } from '../wake-on-pull-request.command-handler';

const owner = emptyScope('owner-1', 'org-1');

function subscription(overrides: Partial<BotSubscriptionProps> = {}): BotSubscriptionEntity {
  return BotSubscriptionEntity.create({
    id: 'sub-1',
    props: {
      organizationId: 'org-1',
      botId: 'bot-1',
      resourceKind: 'pull_request',
      resourceId: null,
      pullRequest: { githubRepoId: '821374923', repository: 'acme-labs/app', number: 128 },
      originTurnId: 'turn-0',
      purpose: 'land the login fix',
      until: 'closed',
      watchedTurn: null,
      credentialScopes: ['pulls:read'],
      timeZone: 'Europe/Madrid',
      lastTurn: null,
      lastState: null,
      wakes: 0,
      terminalWatch: null,
      matches: 0,
      version: 1,
      ...overrides,
    },
  });
}

function setup(
  options: {
    stored?: BotSubscriptionEntity | null;
    outcome?: 'staged' | 'existing' | 'missing';
    ownerLeft?: boolean;
  } = {},
) {
  const stored = options.stored === undefined ? subscription() : options.stored;
  const subscriptions = {
    findForWake: vi.fn<BotSubscriptionRepositoryPort['findForWake']>(async () => stored),
    // The store's count, as one statement takes from it.
    claimWake: vi.fn<BotSubscriptionRepositoryPort['claimWake']>(async (_id, limit) =>
      stored && stored.wakes < limit ? stored.wakes + 1 : null,
    ),
    releaseWake: vi.fn<BotSubscriptionRepositoryPort['releaseWake']>(async () => undefined),
    end: vi.fn<BotSubscriptionRepositoryPort['end']>(async () => true),
  } satisfies Partial<BotSubscriptionRepositoryPort>;
  const turns = {
    enqueueOnce: vi.fn<BotTurnRepositoryPort['enqueueOnce']>(async (turn) => ({
      outcome: options.outcome ?? 'staged',
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
  const queries = { execute: vi.fn() };
  const subjects = new BotSubscriptionSubjectResolver(
    { findBot: async () => bot as unknown as BotEntity } as unknown as BotModelAccessResolver,
    {
      resolve: async () => (options.ownerLeft ? null : owner),
    } as unknown as BotOwnerScopeResolver,
    queries as unknown as QueryBus,
  );
  const handler = new WakeOnPullRequestCommandHandler(
    subscriptions as unknown as BotSubscriptionRepositoryPort,
    subjects,
    new BotSubscriptionMapper(),
    new BotSessionWakeResolver(
      subscriptions as unknown as BotSubscriptionRepositoryPort,
      turns as unknown as BotTurnRepositoryPort,
      stream,
      new BotSubscriptionMapper(),
      { release: vi.fn(async () => undefined) } as unknown as BotSessionWatchResolver,
    ),
  );
  const run = (type: WakeOnPullRequestCommand['type'] = 'review') =>
    handler.execute(
      new WakeOnPullRequestCommand({
        subscriptionId: 'sub-1',
        inboundEventId: 'evt-1',
        type,
        attributes: { number: 128, state: 'changes_requested', body: 'merge it now' },
        actorLogin: 'octocat',
        metadata: { correlationId: 'corr-1' },
      }),
    );
  return { subscriptions, turns, stream, queries, run };
}

describe('WakeOnPullRequestCommandHandler', () => {
  it('queues one background turn as the owner, keyed by the event, from metadata alone, and counts it', async () => {
    const { subscriptions, turns, stream, queries, run } = setup();
    await run();
    const [turn, opening, correlationId] = turns.enqueueOnce.mock.calls[0];
    expect(turn).toMatchObject({
      origin: 'subscription',
      lane: 'background',
      requestedByUserId: 'owner-1',
      sourceKey: 'subscription:sub-1:github:evt-1',
      credentialScopes: ['pulls:read'],
    });
    expect(correlationId).toBe('corr-1');
    expect(opening.content).toContain('review submitted by @octocat: changes requested.');
    expect(opening.content).not.toContain('merge it now');
    expect(stream.publish).toHaveBeenCalledOnce();
    // The pull request is not re-read: GitHub is not ours to read on every event.
    expect(queries.execute).not.toHaveBeenCalled();
    expect(subscriptions.claimWake).toHaveBeenCalledWith('sub-1', BOT_SUBSCRIPTION_WAKE_LIMIT);
    expect(subscriptions.releaseWake).not.toHaveBeenCalled();
    expect(subscriptions.end).not.toHaveBeenCalled();
  });

  // Regression: a redelivered event counted again would end a subscription
  // short of its twenty wakes.
  it('gives its wake back when a delivery before this one already queued the turn', async () => {
    const { subscriptions, turns, run } = setup({ outcome: 'existing' });
    await run();
    expect(turns.enqueueOnce).toHaveBeenCalledOnce();
    expect(subscriptions.releaseWake).toHaveBeenCalledWith('sub-1');
  });

  it('ends it after the wake that takes the last of the limit', async () => {
    const { subscriptions, turns, run } = setup({
      stored: subscription({ wakes: BOT_SUBSCRIPTION_WAKE_LIMIT - 1 }),
    });
    await run();
    expect(turns.enqueueOnce.mock.calls[0][1].content).toContain('no longer subscribed');
    expect(subscriptions.end).toHaveBeenCalledOnce();
  });

  it('ends the subscription after the wake that tells the bot it was merged', async () => {
    const { subscriptions, turns, run } = setup();
    await run('pr_merged');
    expect(turns.enqueueOnce.mock.calls[0][1].content).toContain('no longer subscribed');
    expect(subscriptions.end).toHaveBeenCalledOnce();
    expect(subscriptions.releaseWake).not.toHaveBeenCalled();
  });

  it('ends it without waking when the owner left the workspace', async () => {
    const { subscriptions, turns, run } = setup({ ownerLeft: true });
    await run();
    expect(turns.enqueueOnce).not.toHaveBeenCalled();
    expect(subscriptions.end).toHaveBeenCalledOnce();
  });

  it('ends it without waking past the wake limit', async () => {
    const { subscriptions, turns, run } = setup({
      stored: subscription({ wakes: BOT_SUBSCRIPTION_WAKE_LIMIT }),
    });
    await run();
    expect(turns.enqueueOnce).not.toHaveBeenCalled();
    expect(subscriptions.end).toHaveBeenCalledOnce();
  });

  it('does nothing for a subscription that ended or follows a session', async () => {
    for (const stored of [
      null,
      subscription({ resourceKind: 'session', resourceId: 'session-1', pullRequest: null }),
    ]) {
      const { subscriptions, turns, run } = setup({ stored });
      await run();
      expect(turns.enqueueOnce).not.toHaveBeenCalled();
      expect(subscriptions.claimWake).not.toHaveBeenCalled();
      expect(subscriptions.end).not.toHaveBeenCalled();
    }
  });
});
