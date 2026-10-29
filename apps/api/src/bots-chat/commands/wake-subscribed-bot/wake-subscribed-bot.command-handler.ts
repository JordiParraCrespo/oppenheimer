import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotSessionWatchResolver } from '../../application/bot-session-watch.resolver';
import { BotSubscriptionSubjectResolver } from '../../application/bot-subscription-subject.resolver';
import { BotSubscriptionMapper } from '../../bot-subscription.mapper';
import {
  BOT_STREAM,
  BOT_SUBSCRIPTION_REPOSITORY,
  BOT_TURN_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import type { BotSubscriptionEntity } from '../../domain/bot-subscription.entity';
import { sessionWakeTurn, wakeFor } from '../../domain/bot-subscription.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { WakeSubscribedBotCommand } from './wake-subscribed-bot.command';

/**
 * A session a bot follows moved (`27-bot-subscriptions.md` §4). The event
 * that led here is not trusted for what happened: the session is read again,
 * as the bot's owner, and `wakeFor` decides from the task as it stands now.
 * A wake is a queued turn keyed by the subscription, the task and its state,
 * so an event delivered twice, or two events read the same state, queue one
 * turn; the record comes after the queue, so a process that dies between the
 * two does both again on redelivery and the queue finds the turn it queued.
 */
@CommandHandler(WakeSubscribedBotCommand)
export class WakeSubscribedBotCommandHandler
  implements ICommandHandler<WakeSubscribedBotCommand, void>
{
  private readonly logger = new Logger(WakeSubscribedBotCommandHandler.name);

  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly subjects: BotSubscriptionSubjectResolver,
    private readonly mapper: BotSubscriptionMapper,
    private readonly watches: BotSessionWatchResolver,
  ) {}

  async execute({ subscriptionId, metadata }: WakeSubscribedBotCommand): Promise<void> {
    const subscription = await this.subscriptions.findForWake(subscriptionId);
    if (!subscription) return;
    const subject = await this.subjects.resolve(subscription);
    if (!subject) return this.end(subscription, 'access_lost');

    const { bot, ownerUserId, session } = subject;
    const task = session.latestTurn;
    const decision = wakeFor(subscription.wakeSubject, task, session.isResolved);
    if (decision.kind === 'end') return this.end(subscription, decision.reason);
    if (decision.kind === 'skip' || !task) return;

    const { turn, opening } = sessionWakeTurn(
      this.mapper.toWakeTurnProps(subscription, bot, ownerUserId),
      this.mapper.toWake(subscription, session, task, decision),
    );
    const queued = await this.turns.enqueueOnce(turn, opening, metadata.correlationId, null);
    if (queued.outcome === 'missing') return this.end(subscription, 'access_lost');
    if (queued.outcome === 'staged' || queued.outcome === 'waiting') {
      await this.stream.publish(bot.id, { type: 'turn', turnId: queued.turnId, status: 'queued' });
    }
    if (decision.ends) return this.end(subscription, 'delivered');
    subscription.recordWake(decision.turn, decision.state);
    // A loser was beaten by a wake of the same subscription, which recorded the same or a newer state.
    await this.subscriptions.recordWake(subscription);
  }

  private async end(subscription: BotSubscriptionEntity, reason: string): Promise<void> {
    if (!(await this.subscriptions.end(subscription))) return;
    // Its terminal watch goes with it: nobody would be woken by it any more.
    await this.watches.release(subscription);
    this.logger.log({
      message: 'A bot subscription ended',
      subscriptionId: subscription.id,
      botId: subscription.botId,
      sessionId: subscription.resourceId,
      reason,
    });
  }
}
