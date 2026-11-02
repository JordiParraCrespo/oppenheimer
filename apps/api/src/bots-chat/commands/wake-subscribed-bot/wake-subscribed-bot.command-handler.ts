import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotSessionWakeResolver } from '../../application/bot-session-wake.resolver';
import { BotSubscriptionSubjectResolver } from '../../application/bot-subscription-subject.resolver';
import { BotSubscriptionMapper } from '../../bot-subscription.mapper';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';
import { wakeFor } from '../../domain/bot-subscription.policy';
import { WakeSubscribedBotCommand } from './wake-subscribed-bot.command';

/**
 * A session a bot follows moved (`27-bot-subscriptions.md` §4). The event
 * that led here is not trusted for what happened: the session is read again,
 * as the bot's owner, and `wakeFor` decides from the task as it stands now.
 * The wake itself is the one wake path (`BotSessionWakeResolver`), keyed by
 * the subscription, the task and its state, so an event delivered twice, or
 * two events that read the same state, queue one turn; the record comes after
 * the queue, so a process that dies between the two does both again on
 * redelivery and the queue finds the turn it queued.
 */
@CommandHandler(WakeSubscribedBotCommand)
export class WakeSubscribedBotCommandHandler
  implements ICommandHandler<WakeSubscribedBotCommand, void>
{
  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    private readonly subjects: BotSubscriptionSubjectResolver,
    private readonly mapper: BotSubscriptionMapper,
    private readonly wakes: BotSessionWakeResolver,
  ) {}

  async execute({ subscriptionId, metadata }: WakeSubscribedBotCommand): Promise<void> {
    const subscription = await this.subscriptions.findForWake(subscriptionId);
    if (!subscription) return;
    const subject = await this.subjects.resolve(subscription);
    if (!subject) return this.wakes.end(subscription, 'access_lost');

    const task = subject.session.latestTurn;
    const decision = wakeFor(subscription.wakeSubject, task, subject.session.isResolved);
    if (decision.kind === 'end') return this.wakes.end(subscription, decision.reason);
    if (decision.kind === 'skip' || !task) return;

    const wake = this.mapper.toWake(subscription, subject.session, task, decision);
    if ((await this.wakes.queue(subscription, subject, wake, metadata.correlationId)) === 'missing')
      return;
    if (decision.ends) return this.wakes.end(subscription, 'delivered');
    subscription.recordWake(decision.turn, decision.state);
    // A loser was beaten by a wake of the same subscription, which recorded the same or a newer state.
    await this.subscriptions.recordWake(subscription);
  }
}
