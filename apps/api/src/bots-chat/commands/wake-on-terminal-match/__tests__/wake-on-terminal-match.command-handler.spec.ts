/**
 * A session's terminal printed what a bot watches it for, and the bot is
 * woken (`27-bot-subscriptions.md` §2). What breaks this: the matched text
 * reaching the bot (it never leaves the host, and the event carries none);
 * a report delivered twice, or one older than the count the bot was already
 * woken for, queuing a second turn; a match past the wake limit waking the
 * bot; a watch nobody follows any more left running on the host.
 */
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import type { BotEntity } from '../../../../bots/domain/bot.entity';
import { UnwatchSessionTerminalCommand } from '../../../../sessions/commands/unwatch-session-terminal/unwatch-session-terminal.command';
import type { WorkSessionEntity } from '../../../../sessions/domain/work-session.entity';
import type { BotModelAccessResolver } from '../../../application/bot-model-access.resolver';
import type { BotOwnerScopeResolver } from '../../../application/bot-owner-scope.resolver';
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
import { WakeOnTerminalMatchCommand } from '../wake-on-terminal-match.command';
import { WakeOnTerminalMatchCommandHandler } from '../wake-on-terminal-match.command-handler';

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
      purpose: 'watch the test run',
      until: 'closed',
      watchedTurn: null,
      credentialScopes: null,
      timeZone: 'Europe/Madrid',
      lastTurn: null,
      lastState: null,
      wakes: 0,
      terminalWatch: { id: 'watch-1', pattern: 'FAIL' },
      matches: 0,
      version: 1,
      ...overrides,
    },
  });
}

const session = {
  id: 'session-1',
  name: 'Test run',
  isResolved: false,
  latestTurn: { seq: 2, state: 'in_progress', prompt: 'Run the tests', result: null },
} as unknown as WorkSessionEntity;

function setup(stored: BotSubscriptionEntity | null = subscription()) {
  const subscriptions = {
    findForTerminalWatch: vi.fn<BotSubscriptionRepositoryPort['findForTerminalWatch']>(
      async () => stored,
    ),
    recordWake: vi.fn<BotSubscriptionRepositoryPort['recordWake']>(async () => true),
    end: vi.fn<BotSubscriptionRepositoryPort['end']>(async () => true),
  } satisfies Partial<BotSubscriptionRepositoryPort>;
  const turns = {
    enqueueOnce: vi.fn<BotTurnRepositoryPort['enqueueOnce']>(async (turn) => ({
      outcome: 'staged',
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
  const subjects = new BotSubscriptionSubjectResolver(
    { findBot: async () => bot as unknown as BotEntity } as unknown as BotModelAccessResolver,
    { resolve: async () => owner } as unknown as BotOwnerScopeResolver,
    { execute: async () => session } as unknown as QueryBus,
  );
  const watches = { release: vi.fn(async () => undefined) };
  const commands = { execute: vi.fn(async () => true) };
  const handler = new WakeOnTerminalMatchCommandHandler(
    subscriptions as unknown as BotSubscriptionRepositoryPort,
    turns as unknown as BotTurnRepositoryPort,
    stream,
    subjects,
    watches as unknown as BotSessionWatchResolver,
    new BotSubscriptionMapper(),
    commands as unknown as CommandBus,
  );
  const run = (count: number) =>
    handler.execute(
      new WakeOnTerminalMatchCommand({
        organizationId: 'org-1',
        sessionId: 'session-1',
        watchId: 'watch-1',
        count,
      }),
    );
  return { subscriptions, turns, stream, watches, commands, run };
}

describe('WakeOnTerminalMatchCommandHandler', () => {
  it('queues one turn saying the pattern matched and how often, never the text, and records the count', async () => {
    const { turns, stream, subscriptions, run } = setup();
    await run(3);

    const [turn, opening] = turns.enqueueOnce.mock.calls[0];
    expect(turn).toMatchObject({
      botId: 'bot-1',
      origin: 'subscription',
      sourceKey: 'subscription:sub-1:match:3',
    });
    expect(opening.event).toEqual({
      kind: 'session',
      subscriptionId: 'sub-1',
      sessionId: 'session-1',
      sessionName: 'Test run',
      turn: 2,
      state: 'matched',
      match: { pattern: 'FAIL', count: 3 },
    });
    expect(opening.content).toContain('matching “FAIL” (3 matching lines so far)');
    expect(stream.publish).toHaveBeenCalledWith('bot-1', expect.objectContaining({ type: 'turn' }));
    const recorded = subscriptions.recordWake.mock.calls[0][0];
    expect([recorded.matches, recorded.wakes]).toEqual([3, 1]);
  });

  it('wakes nobody for a count the bot was already woken for', async () => {
    const { turns, subscriptions, run } = setup(subscription({ matches: 5, wakes: 2 }));
    await run(5);
    await run(4);
    expect(turns.enqueueOnce).not.toHaveBeenCalled();
    expect(subscriptions.recordWake).not.toHaveBeenCalled();
  });

  it('removes a watch nobody follows any more, waking nobody', async () => {
    const { turns, commands, run } = setup(null);
    await run(1);
    expect(turns.enqueueOnce).not.toHaveBeenCalled();
    expect(commands.execute).toHaveBeenCalledWith(expect.any(UnwatchSessionTerminalCommand));
    expect(commands.execute.mock.calls[0][0]).toMatchObject({
      organizationId: 'org-1',
      sessionId: 'session-1',
      watchId: 'watch-1',
    });
  });

  it('ends the subscription and its watch at the wake limit, the last wake saying so', async () => {
    const atLimit = setup(subscription({ wakes: BOT_SUBSCRIPTION_WAKE_LIMIT }));
    await atLimit.run(9);
    expect(atLimit.turns.enqueueOnce).not.toHaveBeenCalled();
    expect(atLimit.subscriptions.end).toHaveBeenCalled();
    expect(atLimit.watches.release).toHaveBeenCalled();

    const last = setup(subscription({ wakes: BOT_SUBSCRIPTION_WAKE_LIMIT - 1 }));
    await last.run(9);
    expect(last.turns.enqueueOnce.mock.calls[0][1].content).toContain(
      'You are no longer subscribed to it after this.',
    );
    expect(last.subscriptions.end).toHaveBeenCalled();
    expect(last.subscriptions.recordWake).not.toHaveBeenCalled();
  });
});
