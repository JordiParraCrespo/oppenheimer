import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { BotSubscriptionSubjectResolver } from '../../application/bot-subscription-subject.resolver';
import { BotSubscriptionMapper } from '../../bot-subscription.mapper';
import {
  BOT_STALL_CHECKS,
  BOT_STREAM,
  BOT_SUBSCRIPTION_REPOSITORY,
  BOT_TURN_REPOSITORY,
} from '../../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { checkDelayMs, checkFor, sessionWakeTurn } from '../../domain/bot-subscription.policy';
import type { BotStallChecksPort } from '../../infrastructure/bot-stall-checks.port';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { CheckStalledSessionCommand } from './check-stalled-session.command';

/**
 * One check of a task a bot handed off (`27-bot-subscriptions.md` §4.1,
 * §4.2): the session read again as the bot's owner, and `checkFor` deciding.
 * A task stuck short of every state that wakes the bot wakes it as a stall,
 * once per task; a task still running wakes it for a look at its progress,
 * once per check, which it ends with `nothing_to_report` when all is well.
 * While the task is live the next check is staged, up to
 * `BOT_PROGRESS_CHECKS_PER_TASK`. Each wake is keyed by the subscription, the
 * task and what it is, so a retried job tells the bot once, and none records
 * anything on the subscription: the task's own end still wakes the bot as
 * before. A subscription gone, or a session the owner can no longer read, is
 * the wake path's to end; the check only stays quiet and stages no more.
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
    @Inject(BOT_STALL_CHECKS) private readonly checks: BotStallChecksPort,
  ) {}

  async execute({
    subscriptionId,
    turn: checked,
    check,
    metadata,
  }: CheckStalledSessionCommand): Promise<void> {
    const subscription = await this.subscriptions.findForWake(subscriptionId);
    if (!subscription) return;
    const subject = await this.subjects.resolve(subscription);
    if (!subject) return;

    const { bot, ownerUserId, session } = subject;
    const task = session.latestTurn;
    const decision = checkFor(subscription.wakeSubject, checked, check, task, {
      closed: session.isResolved,
      place: session.place,
    });
    if (decision.kind === 'skip' || !task) return;

    if (decision.kind === 'wake') {
      const wake = this.mapper.toCheckWake(subscription, session, task, decision.finding);
      const { turn, opening } = sessionWakeTurn(
        this.mapper.toWakeTurnProps(subscription, bot, ownerUserId),
        wake,
      );
      const queued = await this.turns.enqueueOnce(turn, opening, metadata.correlationId, null);
      if (queued.outcome === 'staged' || queued.outcome === 'waiting') {
        await this.stream.publish(bot.id, {
          type: 'turn',
          turnId: queued.turnId,
          status: 'queued',
        });
      }
    }
    if (decision.next) {
      await this.checks.schedule(
        { subscriptionId, botId: bot.id, sessionId: session.id, turn: checked, check: check + 1 },
        new Date(Date.now() + checkDelayMs(check + 1) - checkDelayMs(check)),
        metadata.correlationId ?? null,
      );
    }
  }
}
