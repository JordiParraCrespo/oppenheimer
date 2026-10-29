import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotSubscriptionSubjectResolver } from '../../application/bot-subscription-subject.resolver';
import { BotSubscriptionMapper } from '../../bot-subscription.mapper';
import {
  BOT_STREAM,
  BOT_SUBSCRIPTION_REPOSITORY,
  BOT_TURN_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { sessionWakeTurn, stallFor } from '../../domain/bot-subscription.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { CheckStalledSessionCommand } from './check-stalled-session.command';

/**
 * The silent stall check (`27-bot-subscriptions.md` §4.1): the session read
 * again as the bot's owner, and the bot woken only when `stallFor` finds the
 * task it handed off stuck short of every state that wakes it. The wake is
 * keyed by the subscription and the task, so a retried job tells the bot
 * once, and it records nothing on the subscription: the task's own end still
 * wakes the bot as before. A subscription gone, or a session the owner can no
 * longer read, is the wake path's to end; the check only stays quiet.
 */
@CommandHandler(CheckStalledSessionCommand)
export class CheckStalledSessionCommandHandler
  implements ICommandHandler<CheckStalledSessionCommand, void>
{
  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly subjects: BotSubscriptionSubjectResolver,
    private readonly mapper: BotSubscriptionMapper,
  ) {}

  async execute({
    subscriptionId,
    turn: checked,
    metadata,
  }: CheckStalledSessionCommand): Promise<void> {
    const subscription = await this.subscriptions.findForWake(subscriptionId);
    if (!subscription) return;
    const subject = await this.subjects.resolve(subscription);
    if (!subject) return;

    const { bot, ownerUserId, session } = subject;
    const task = session.latestTurn;
    const decision = stallFor(subscription.wakeSubject, checked, task, {
      closed: session.isResolved,
      place: session.place,
    });
    if (decision.kind === 'skip' || !task) return;

    const { turn, opening } = sessionWakeTurn(
      this.mapper.toWakeTurnProps(subscription, bot, ownerUserId),
      this.mapper.toStallWake(subscription, session, task, decision),
    );
    const queued = await this.turns.enqueueOnce(turn, opening, metadata.correlationId, null);
    if (queued.outcome === 'staged' || queued.outcome === 'waiting') {
      await this.stream.publish(bot.id, { type: 'turn', turnId: queued.turnId, status: 'queued' });
    }
  }
}
