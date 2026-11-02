import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BotEntity } from '../../bots/domain/bot.entity';
import { BotSubscriptionMapper } from '../bot-subscription.mapper';
import {
  BOT_STREAM,
  BOT_SUBSCRIPTION_REPOSITORY,
  BOT_TURN_REPOSITORY,
} from '../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../database/bot-subscription.repository.port';
import type { BotTurnRepositoryPort } from '../database/bot-turn.repository.port';
import type { BotSubscriptionEntity } from '../domain/bot-subscription.entity';
import { type SessionWake, sessionWakeTurn } from '../domain/bot-subscription.policy';
import type { BotStreamPort } from '../infrastructure/bot-stream.port';
import { BotSessionWatchResolver } from './bot-session-watch.resolver';

/**
 * The one way a subscription wakes its bot, or ends (`27-bot-subscriptions.md`
 * §4), whatever woke it: a task's state or a terminal match. A wake is a
 * queued turn keyed by `wakeSourceKey`, so an event delivered twice queues
 * one; an end deletes the subscription and the terminal watch it named.
 */
@Injectable()
export class BotSessionWakeResolver {
  private readonly logger = new Logger(BotSessionWakeResolver.name);

  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly mapper: BotSubscriptionMapper,
    private readonly watches: BotSessionWatchResolver,
  ) {}

  /**
   * Queues the wake's turn as the bot's owner and says so on the bot's
   * stream; `missing` when the bot is gone, which ends the subscription.
   */
  async queue(
    subscription: BotSubscriptionEntity,
    owner: { bot: BotEntity; ownerUserId: string },
    wake: SessionWake,
    correlationId: string | null,
  ): Promise<'queued' | 'missing'> {
    const { turn, opening } = sessionWakeTurn(
      this.mapper.toWakeTurnProps(subscription, owner.bot, owner.ownerUserId),
      wake,
    );
    const queued = await this.turns.enqueueOnce(turn, opening, correlationId, null);
    if (queued.outcome === 'missing') {
      await this.end(subscription, 'access_lost');
      return 'missing';
    }
    if (queued.outcome === 'staged' || queued.outcome === 'waiting') {
      await this.stream.publish(owner.bot.id, {
        type: 'turn',
        turnId: queued.turnId,
        status: 'queued',
      });
    }
    return 'queued';
  }

  /** Ends the subscription, once, and releases its terminal watch: nobody would be woken by it. */
  async end(subscription: BotSubscriptionEntity, reason: string): Promise<void> {
    if (!(await this.subscriptions.end(subscription))) return;
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
