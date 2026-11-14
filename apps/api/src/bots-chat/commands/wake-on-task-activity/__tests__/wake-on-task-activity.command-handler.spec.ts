/**
 * A change to a task on a project or milestone a bot follows wakes it
 * (`27-bot-subscriptions.md` §7.2). What breaks this: the bot woken by its own
 * move; a change delivered twice counted twice; a bot whose owner can no
 * longer read the project woken, or kept subscribed; a session subscription
 * woken by a task. The text the bot reads is `bot-task-wake.policy.spec.ts`.
 */
import type { QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { BOT_TASK_WAKE_DEFAULT } from '@oppenheimer/shared';
import type { BotEntity } from '../../../../bots/domain/bot.entity';
import { ProjectErrors } from '../../../../projects/domain/projects.errors';
import type { BotModelAccessResolver } from '../../../application/bot-model-access.resolver';
import type { BotOwnerScopeResolver } from '../../../application/bot-owner-scope.resolver';
import { BotPlanWatchResolver } from '../../../application/bot-plan-watch.resolver';
import { BotSessionWakeResolver } from '../../../application/bot-session-wake.resolver';
import type { BotSessionWatchResolver } from '../../../application/bot-session-watch.resolver';
import { BotSubscriptionSubjectResolver } from '../../../application/bot-subscription-subject.resolver';
import { BotSubscriptionMapper } from '../../../bot-subscription.mapper';
import type { BotSubscriptionRepositoryPort } from '../../../database/bot-subscription.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotSubscriptionEntity } from '../../../domain/bot-subscription.entity';
import type { TaskActivityFields } from '../../../domain/bot-task-wake.policy';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { WakeOnTaskActivityCommand } from '../wake-on-task-activity.command';
import { WakeOnTaskActivityCommandHandler } from '../wake-on-task-activity.command-handler';

const owner = emptyScope('owner-1', 'org-1');

function following(): BotSubscriptionEntity {
  return BotSubscriptionEntity.subscribeToPlan({
    organizationId: 'org-1',
    botId: 'bot-1',
    scope: 'project',
    resourceId: 'project-1',
    taskEvents: BOT_TASK_WAKE_DEFAULT,
    originTurnId: 'turn-0',
    purpose: null,
    credentialScopes: null,
    timeZone: 'UTC',
  });
}

function change(overrides: Partial<TaskActivityFields> = {}): TaskActivityFields {
  return {
    eventId: 'evt-1',
    taskId: 'task-1',
    kind: 'completed',
    projectId: 'project-1',
    milestoneId: null,
    title: 'Ship the docs',
    from: 'doing',
    to: 'done',
    actor: { type: 'user', userId: 'owner-1' },
    ...overrides,
  };
}

function setup(
  options: {
    stored?: BotSubscriptionEntity | null;
    outcome?: 'staged' | 'existing' | 'missing';
    projectGone?: boolean;
  } = {},
) {
  const stored = options.stored === undefined ? following() : options.stored;
  const subscriptions = {
    findForWake: vi.fn<BotSubscriptionRepositoryPort['findForWake']>(async () => stored),
    countWake: vi.fn<BotSubscriptionRepositoryPort['countWake']>(async () => undefined),
    end: vi.fn<BotSubscriptionRepositoryPort['end']>(async () => true),
  } satisfies Partial<BotSubscriptionRepositoryPort>;
  const turns = {
    enqueueOnce: vi.fn<BotTurnRepositoryPort['enqueueOnce']>(async (turn) => ({
      outcome: options.outcome ?? 'staged',
      turnId: turn.id,
    })),
  } satisfies Partial<BotTurnRepositoryPort>;
  const bot = {
    id: 'bot-1',
    createdByUserId: 'owner-1',
    provider: 'anthropic',
    model: 'm',
    effort: null,
  };
  const queries = {
    execute: vi.fn(async () => {
      if (options.projectGone) throw new AppError(ProjectErrors.NOT_FOUND);
      return { name: 'Web' };
    }),
  };
  const subjects = new BotSubscriptionSubjectResolver(
    { findBot: async () => bot as unknown as BotEntity } as unknown as BotModelAccessResolver,
    { resolve: async () => owner } as unknown as BotOwnerScopeResolver,
    queries as unknown as QueryBus,
  );
  const handler = new WakeOnTaskActivityCommandHandler(
    subscriptions as unknown as BotSubscriptionRepositoryPort,
    subjects,
    new BotPlanWatchResolver(
      subscriptions as unknown as BotSubscriptionRepositoryPort,
      queries as unknown as QueryBus,
    ),
    new BotSubscriptionMapper(),
    new BotSessionWakeResolver(
      subscriptions as unknown as BotSubscriptionRepositoryPort,
      turns as unknown as BotTurnRepositoryPort,
      { publish: vi.fn<BotStreamPort['publish']>(async () => undefined) },
      new BotSubscriptionMapper(),
      { release: vi.fn(async () => undefined) } as unknown as BotSessionWatchResolver,
    ),
  );
  const run = (fields: Partial<TaskActivityFields> = {}) =>
    handler.execute(
      new WakeOnTaskActivityCommand({
        subscriptionId: 'sub-1',
        change: change(fields),
        metadata: { correlationId: 'corr-1' },
      }),
    );
  return { run, subscriptions, turns, stored };
}

describe('WakeOnTaskActivityCommandHandler', () => {
  it('queues one background turn for a followed change and counts the wake', async () => {
    const { run, turns, subscriptions, stored } = setup();
    await run();
    expect(turns.enqueueOnce).toHaveBeenCalledTimes(1);
    const [turn, opening] = turns.enqueueOnce.mock.calls[0];
    expect(turn.sourceKey).toBe(`subscription:${stored?.id}:task:evt-1`);
    expect(opening.content).toContain('project "Web"');
    expect(subscriptions.countWake).toHaveBeenCalledTimes(1);
  });

  it('counts a change delivered again, which queues nothing new, once', async () => {
    const { run, subscriptions } = setup({ outcome: 'existing' });
    await run();
    expect(subscriptions.countWake).not.toHaveBeenCalled();
  });

  it("does not wake the bot for its own move, nor for a change it didn't name", async () => {
    const { run, turns } = setup();
    await run({ actor: { type: 'agent', userId: 'owner-1', agentId: 'bot-1' } });
    await run({ kind: 'rescheduled' });
    expect(turns.enqueueOnce).not.toHaveBeenCalled();
  });

  it('ends the subscription once its owner can no longer read the project', async () => {
    const { run, turns, subscriptions } = setup({ projectGone: true });
    await run();
    expect(turns.enqueueOnce).not.toHaveBeenCalled();
    expect(subscriptions.end).toHaveBeenCalledTimes(1);
  });

  it('leaves a session subscription alone', async () => {
    const session = BotSubscriptionEntity.subscribe({
      organizationId: 'org-1',
      botId: 'bot-1',
      sessionId: 'session-1',
      originTurnId: null,
      purpose: null,
      until: 'closed',
      watchedTurn: null,
      credentialScopes: null,
      timeZone: null,
      known: null,
    });
    const { run, turns, subscriptions } = setup({ stored: session });
    await run();
    expect(turns.enqueueOnce).not.toHaveBeenCalled();
    expect(subscriptions.end).not.toHaveBeenCalled();
  });
});
