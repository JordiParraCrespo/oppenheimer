import { Inject, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { UnwatchSessionTerminalCommand } from '../../../sessions/commands/unwatch-session-terminal/unwatch-session-terminal.command';
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
import {
  BOT_SUBSCRIPTION_WAKE_LIMIT,
  terminalMatchTurn,
} from '../../domain/bot-subscription.policy';
import type { BotStreamPort } from '../../infrastructure/bot-stream.port';
import { WakeOnTerminalMatchCommand } from './wake-on-terminal-match.command';

/**
 * A session's terminal printed what a bot watches it for
 * (`27-bot-subscriptions.md` §2). The bot is woken with a turn that says the
 * pattern matched and how often, never what was printed, keyed by the
 * subscription and the runner's cumulative count, so a report delivered
 * twice is one turn and a stale one (a count the bot was already woken for)
 * is none. Matches count toward the subscription's wake limit; at the limit
 * the subscription ends, and so does its watch. A watch nobody follows any
 * more is removed.
 */
@CommandHandler(WakeOnTerminalMatchCommand)
export class WakeOnTerminalMatchCommandHandler
  implements ICommandHandler<WakeOnTerminalMatchCommand, void>
{
  private readonly logger = new Logger(WakeOnTerminalMatchCommandHandler.name);

  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    @Inject(BOT_TURN_REPOSITORY) private readonly turns: BotTurnRepositoryPort,
    @Inject(BOT_STREAM) private readonly stream: BotStreamPort,
    private readonly subjects: BotSubscriptionSubjectResolver,
    private readonly watches: BotSessionWatchResolver,
    private readonly mapper: BotSubscriptionMapper,
    private readonly commands: CommandBus,
  ) {}

  async execute(command: WakeOnTerminalMatchCommand): Promise<void> {
    const { organizationId, sessionId, watchId, count, metadata } = command;
    const subscription = await this.subscriptions.findForTerminalWatch(watchId);
    if (!subscription) {
      await this.commands.execute(
        new UnwatchSessionTerminalCommand({ organizationId, sessionId, watchId }),
      );
      return;
    }
    if (count <= subscription.matches) return;
    const subject = await this.subjects.resolve(subscription);
    if (!subject) return this.end(subscription, 'access_lost');
    if (subscription.wakes >= BOT_SUBSCRIPTION_WAKE_LIMIT) {
      return this.end(subscription, 'wake_limit');
    }

    const { bot, ownerUserId, session } = subject;
    const ends = subscription.wakes + 1 >= BOT_SUBSCRIPTION_WAKE_LIMIT;
    const { turn, opening } = terminalMatchTurn(
      this.mapper.toWakeTurnProps(subscription, bot, ownerUserId),
      this.mapper.toTerminalMatchWake(subscription, session, count, ends),
    );
    const queued = await this.turns.enqueueOnce(turn, opening, metadata.correlationId, null);
    if (queued.outcome === 'missing') return this.end(subscription, 'access_lost');
    if (queued.outcome === 'staged' || queued.outcome === 'waiting') {
      await this.stream.publish(bot.id, { type: 'turn', turnId: queued.turnId, status: 'queued' });
    }
    if (ends) return this.end(subscription, 'wake_limit');
    subscription.recordMatch(count);
    // A loser was beaten by another wake of the same subscription, which recorded its own.
    await this.subscriptions.recordWake(subscription);
  }

  private async end(subscription: BotSubscriptionEntity, reason: string): Promise<void> {
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
