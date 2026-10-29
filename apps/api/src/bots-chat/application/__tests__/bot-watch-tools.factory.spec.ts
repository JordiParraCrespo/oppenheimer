/**
 * The tools a bot follows sessions with (`27-bot-subscriptions.md` §3): a
 * watch stored for the turn that asked, with its scopes and zone, as the
 * owner may read the session; none of them asks; unwatch and list touch
 * only the bot's own subscriptions. The upsert itself is the integration
 * suite's.
 */
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { UnwatchSessionTerminalCommand } from '../../../sessions/commands/unwatch-session-terminal/unwatch-session-terminal.command';
import { WatchSessionTerminalCommand } from '../../../sessions/commands/watch-session-terminal/watch-session-terminal.command';
import { SessionErrors } from '../../../sessions/domain/sessions.errors';
import type { WorkSessionEntity } from '../../../sessions/domain/work-session.entity';
import { FindSessionQuery } from '../../../sessions/queries/find-session/find-session.query';
import { BotSubscriptionMapper } from '../../bot-subscription.mapper';
import { WakeSubscribedBotCommand } from '../../commands/wake-subscribed-bot/wake-subscribed-bot.command';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';
import { BotSubscriptionEntity } from '../../domain/bot-subscription.entity';
import { BOT_SUBSCRIPTIONS_PER_BOT } from '../../domain/bot-subscription.policy';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import { BotSessionWaitResolver } from '../bot-session-wait.resolver';
import { BotSessionWatchResolver } from '../bot-session-watch.resolver';
import type { BotToolContext } from '../bot-tool.factory';
import { BotWatchToolsFactory } from '../bot-watch-tools.factory';

const owner = emptyScope('owner-1', 'org-1');
const SESSION = '33333333-3333-4333-8333-333333333333';

function liveSession(state: string, seq = 1, isResolved = false) {
  return {
    id: SESSION,
    name: 'Research',
    isResolved,
    latestTurn: { seq, state },
  } as unknown as WorkSessionEntity;
}

function stored(overrides: { resourceId?: string; wakes?: number } = {}) {
  return BotSubscriptionEntity.create({
    id: 'sub-1',
    createdAt: new Date('2026-10-22T10:00:00Z'),
    props: {
      organizationId: 'org-1',
      botId: 'bot-1',
      resourceKind: 'session',
      resourceId: overrides.resourceId ?? SESSION,
      originTurnId: 'turn-1',
      purpose: 'research',
      until: 'task',
      watchedTurn: 1,
      credentialScopes: null,
      timeZone: 'UTC',
      lastTurn: null,
      lastState: null,
      wakes: overrides.wakes ?? 0,
      version: 1,
    },
  });
}

function setup(
  options: {
    read?: WorkSessionEntity | Error | (() => WorkSessionEntity);
    following?: BotSubscriptionEntity[];
    replacedWatch?: string;
    hints?: string[];
  } = {},
) {
  const subscriptions = {
    subscribe: vi.fn<BotSubscriptionRepositoryPort['subscribe']>(
      async (subscription) => subscription,
    ),
    findForBot: vi.fn<BotSubscriptionRepositoryPort['findForBot']>(
      async () => options.following ?? [],
    ),
    unsubscribe: vi.fn<BotSubscriptionRepositoryPort['unsubscribe']>(async () => true),
    attachTerminalWatch: vi.fn<BotSubscriptionRepositoryPort['attachTerminalWatch']>(
      async () => options.replacedWatch ?? null,
    ),
  };
  const queries = {
    execute: vi.fn(async (query: unknown) => {
      expect(query).toBeInstanceOf(FindSessionQuery);
      const read = options.read ?? liveSession('in_progress');
      if (read instanceof Error) throw read;
      return typeof read === 'function' ? read() : read;
    }),
  };
  const repository = subscriptions as unknown as BotSubscriptionRepositoryPort;
  const commands = {
    execute: vi.fn(async (command: unknown) =>
      command instanceof WatchSessionTerminalCommand
        ? { sessionId: SESSION, watchId: 'watch-new', hints: options.hints ?? [] }
        : undefined,
    ),
  };
  const resolver = new BotSessionWatchResolver(
    repository,
    queries as unknown as QueryBus,
    commands as unknown as CommandBus,
    new BotSubscriptionMapper(),
  );
  const factory = new BotWatchToolsFactory(
    resolver,
    repository,
    new BotSubscriptionMapper(),
    new BotSessionWaitResolver(queries as unknown as QueryBus),
  );
  const approvals = { request: vi.fn<BotApprovalRequesterPort['request']>() };
  const context: BotToolContext = {
    owner,
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    homeHostId: null,
    timeZone: 'Europe/Madrid',
    permission: 'auto',
    permissions: NO_PERMISSIONS,
    approvals,
    budget: new BotTurnBudget(),
    credentialScopes: ['sessions:read', 'sessions:write'],
  };
  const call = (name: string, input: unknown) => {
    const definition = factory.definitions().find((candidate) => candidate.name === name);
    if (!definition) throw new Error(`no tool ${name}`);
    return definition.bind(context).run(input, { signal: new AbortController().signal });
  };
  return { subscriptions, queries, commands, approvals, call, resolver, context };
}

describe('BotWatchToolsFactory', () => {
  it('follows the live task of a session the owner can read, for the turn that asked, without a card', async () => {
    const { subscriptions, queries, approvals, call } = setup({
      read: liveSession('requires_action', 2),
    });
    const result = await call('watch_session', { session_id: SESSION, purpose: 'research skills' });
    expect(queries.execute.mock.calls[0][0]).toMatchObject({ scope: owner, sessionId: SESSION });
    const saved = subscriptions.subscribe.mock.calls[0][0];
    expect(saved).toMatchObject({
      botId: 'bot-1',
      resourceId: SESSION,
      originTurnId: 'turn-1',
      purpose: 'research skills',
      until: 'task',
      watchedTurn: 2,
      credentialScopes: ['sessions:read', 'sessions:write'],
      timeZone: 'Europe/Madrid',
      // Input needed is already in front of the bot: only what comes next wakes it.
      lastTurn: 2,
      lastState: 'requires_action',
    });
    expect(approvals.request).not.toHaveBeenCalled();
    expect(result.isError).toBe(false);
    expect(result.content).toContain('task #2, until it ends');
  });

  it('follows the next task when the latest has already ended, and says so', async () => {
    const { subscriptions, call } = setup({ read: liveSession('completed', 3) });
    const result = await call('watch_session', { session_id: SESSION });
    expect(subscriptions.subscribe.mock.calls[0][0]).toMatchObject({ watchedTurn: 4, lastTurn: 3 });
    expect(result.content).toContain('task #4 (its next one)');
  });

  it('follows every task until the session closes when asked', async () => {
    const { subscriptions, call } = setup();
    await call('watch_session', { session_id: SESSION, until: 'closed' });
    expect(subscriptions.subscribe.mock.calls[0][0]).toMatchObject({
      until: 'closed',
      watchedTurn: null,
    });
  });

  // What breaks this: a bot following a session its owner cannot read.
  it('stores nothing for a session the owner cannot read, one that is closed, or past the cap', async () => {
    const refused = setup({ read: new AppError(SessionErrors.NOT_FOUND) });
    expect((await refused.call('watch_session', { session_id: SESSION })).isError).toBe(true);
    expect(refused.subscriptions.subscribe).not.toHaveBeenCalled();

    const closed = setup({ read: liveSession('completed', 1, true) });
    const answer = await closed.call('watch_session', { session_id: SESSION });
    expect(answer.content).toContain('is closed');
    expect(closed.subscriptions.subscribe).not.toHaveBeenCalled();

    const many = Array.from({ length: BOT_SUBSCRIPTIONS_PER_BOT }, (_, index) =>
      stored({ resourceId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` }),
    );
    const full = setup({ following: many });
    expect((await full.call('watch_session', { session_id: SESSION })).content).toContain(
      `already follow ${BOT_SUBSCRIPTIONS_PER_BOT} sessions`,
    );
    expect(full.subscriptions.subscribe).not.toHaveBeenCalled();
  });

  it("unwatches only the bot's own subscription, and lists what it follows", async () => {
    const { subscriptions, call } = setup({ following: [stored({ wakes: 2 })] });
    expect((await call('unwatch_session', { session_id: SESSION })).content).toBe(
      `You no longer follow session ${SESSION}.`,
    );
    expect(subscriptions.unsubscribe).toHaveBeenCalledWith('org-1', 'bot-1', SESSION);
    const listed = await call('list_watches', {});
    expect(subscriptions.findForBot).toHaveBeenCalledWith(
      'org-1',
      'bot-1',
      BOT_SUBSCRIPTIONS_PER_BOT,
    );
    expect(listed.content).toContain(`session ${SESSION} [task #1; woke you 2 of 20 times;`);
    expect(listed.content).toContain('— research');
  });

  // What breaks this: a session started on the host that the bot is told
  // was not, because storing its watch failed.
  // What breaks this: a session whose launch failed before the watch was
  // stored, so its one event found nobody, and the bot never hears of it.
  it('follows a started session from its first task, however far it got, and reconciles it at once', async () => {
    const { resolver, context, subscriptions, commands } = setup({
      read: liveSession('failed', 1),
    });
    expect(await resolver.follow(context, SESSION, 'first_task')).toContain(
      'You are subscribed to it',
    );
    expect(subscriptions.subscribe.mock.calls[0][0]).toMatchObject({
      until: 'task',
      purpose: null,
      watchedTurn: 1,
      lastTurn: null,
      lastState: null,
    });
    const [wake] = commands.execute.mock.calls[0] as unknown as [WakeSubscribedBotCommand];
    expect(wake).toBeInstanceOf(WakeSubscribedBotCommand);
    expect(wake.subscriptionId).toBe(subscriptions.subscribe.mock.calls[0][0].id);
  });

  // What breaks this: a prompt whose task finished before the watch was
  // stored, counted as the next task's or as already known, so the bot that
  // was told to wait is never woken.
  it('follows the task a prompt opened by its number, unknown, and reconciles it at once', async () => {
    const { resolver, context, subscriptions, commands } = setup({
      read: liveSession('completed', 3),
    });
    expect(await resolver.follow(context, SESSION, { turn: 3 })).toContain(
      'You are subscribed to it',
    );
    expect(subscriptions.subscribe.mock.calls[0][0]).toMatchObject({
      watchedTurn: 3,
      lastTurn: null,
      lastState: null,
    });
    const [wake] = commands.execute.mock.calls[0] as unknown as [WakeSubscribedBotCommand];
    expect(wake).toBeInstanceOf(WakeSubscribedBotCommand);
  });

  it("says when start_session's watch could not be stored rather than throw", async () => {
    const { resolver, context, subscriptions, commands } = setup();

    subscriptions.subscribe.mockRejectedValueOnce(new Error('connection reset'));
    expect(await resolver.follow(context, SESSION, 'first_task')).toBe(
      'It could not be watched (connection reset); read it later with get_session.',
    );
    expect(commands.execute).not.toHaveBeenCalled();
  });
});

describe('watch_session with a pattern', () => {
  it('has the session watch its terminal as the owner, and the subscription name the watch', async () => {
    const { commands, subscriptions, call } = setup();
    const result = await call('watch_session', { session_id: SESSION, pattern: 'FAIL|Error' });
    const made = commands.execute.mock.calls
      .map(([command]) => command)
      .find((command) => command instanceof WatchSessionTerminalCommand);
    expect(made).toMatchObject({ scope: owner, sessionId: SESSION, pattern: 'FAIL|Error' });
    expect(subscriptions.attachTerminalWatch).toHaveBeenCalledWith(expect.any(String), {
      id: 'watch-new',
      pattern: 'FAIL|Error',
    });
    expect(result.content).toContain('new line matching “FAIL|Error”');
    expect(result.content).toContain('not the line');
  });

  it('removes the watch a new pattern replaces, and says when the host cannot watch yet', async () => {
    const { commands, call } = setup({ replacedWatch: 'watch-old', hints: ['host_offline'] });
    const result = await call('watch_session', { session_id: SESSION, pattern: 'PASS' });
    const removed = commands.execute.mock.calls
      .map(([command]) => command)
      .find((command) => command instanceof UnwatchSessionTerminalCommand);
    expect(removed).toMatchObject({ sessionId: SESSION, watchId: 'watch-old' });
    expect(result.content).toContain('starts when it reconnects');
  });
});

describe('wait_for_session', () => {
  afterEach(() => vi.useRealTimers());

  it('answers at once when the task already ended, reading the session in the owner’s scope', async () => {
    const { call, queries } = setup({ read: liveSession('completed') });
    const result = await call('wait_for_session', { session_id: SESSION, seconds: 30 });
    expect(result.content).toMatch(/finished its task \(after 0s\)/);
    expect(queries.execute).toHaveBeenCalledTimes(1);
    expect(queries.execute.mock.calls[0][0]).toMatchObject({ scope: owner, sessionId: SESSION });
  });

  it('waits until the task asks for input, reading again every few seconds', async () => {
    vi.useFakeTimers();
    let reads = 0;
    const { call } = setup({
      read: () => liveSession(++reads < 3 ? 'in_progress' : 'requires_action'),
    });
    const waiting = call('wait_for_session', { session_id: SESSION, seconds: 60 });
    await vi.advanceTimersByTimeAsync(6_000);
    const result = await waiting;
    expect(reads).toBe(3);
    expect(result.content).toMatch(/needs input \(after 6s\)/);
  });

  it('says the session is still working when its time runs out', async () => {
    vi.useFakeTimers();
    const { call } = setup({ read: liveSession('in_progress') });
    const waiting = call('wait_for_session', { session_id: SESSION, seconds: 10 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await waiting).content).toMatch(/still working after 9s/);
  });

  it('refuses a fourth wait in one turn, reading nothing', async () => {
    const { call, queries } = setup({ read: liveSession('completed') });
    for (let i = 0; i < 3; i++) await call('wait_for_session', { session_id: SESSION });
    const fourth = await call('wait_for_session', { session_id: SESSION });
    expect(fourth.isError).toBe(true);
    expect(fourth.content).toContain('watch_session');
    expect(queries.execute).toHaveBeenCalledTimes(3);
  });
});
