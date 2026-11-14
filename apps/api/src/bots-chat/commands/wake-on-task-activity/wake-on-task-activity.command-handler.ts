import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotPlanWatchResolver } from '../../application/bot-plan-watch.resolver';
import { BotSessionWakeResolver } from '../../application/bot-session-wake.resolver';
import { BotSubscriptionSubjectResolver } from '../../application/bot-subscription-subject.resolver';
import { toTaskWake } from '../../bot-plan-tool.mapper';
import { BotSubscriptionMapper } from '../../bot-subscription.mapper';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';
import { taskWakeFor, taskWakeTurn } from '../../domain/bot-task-wake.policy';
import { WakeOnTaskActivityCommand } from './wake-on-task-activity.command';

/**
 * A change to a task on a project or milestone a bot follows
 * (`27-bot-subscriptions.md` §7.2). The bot and its owner are resolved again,
 * as for any wake, and so is what it follows, as that owner reads it now: a
 * project or milestone the owner can no longer read ends the subscription.
 * It is the one wake path (`BotSessionWakeResolver.queueTurn`), keyed by the
 * subscription and the change, so a change delivered twice queues one turn
 * and counts one wake.
 */
@CommandHandler(WakeOnTaskActivityCommand)
export class WakeOnTaskActivityCommandHandler
  implements ICommandHandler<WakeOnTaskActivityCommand, void>
{
  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    private readonly subjects: BotSubscriptionSubjectResolver,
    private readonly plans: BotPlanWatchResolver,
    private readonly mapper: BotSubscriptionMapper,
    private readonly wakes: BotSessionWakeResolver,
  ) {}

  async execute(command: WakeOnTaskActivityCommand): Promise<void> {
    const subscription = await this.subscriptions.findForWake(command.subscriptionId);
    const plan = subscription?.plan;
    if (!subscription || !plan) return;
    if (taskWakeFor({ botId: subscription.botId, ...plan }, command.change).kind === 'skip') return;
    const acting = await this.subjects.resolveOwner(subscription);
    if (!acting) return this.wakes.end(subscription, 'access_lost');
    const followedName = await this.plans.nameOf(acting.owner, plan.scope, plan.id);
    if (followedName === null) return this.wakes.end(subscription, 'access_lost');

    const wake = toTaskWake(subscription, plan, command.change, {
      followedName,
      ownerUserId: acting.ownerUserId,
    });
    const built = taskWakeTurn(
      this.mapper.toWakeTurnProps(subscription, acting.bot, acting.ownerUserId),
      wake,
    );
    const queued = await this.wakes.queueTurn(
      subscription,
      acting,
      built,
      command.metadata.correlationId,
    );
    if (queued === 'queued') await this.subscriptions.countWake(subscription.id);
  }
}
