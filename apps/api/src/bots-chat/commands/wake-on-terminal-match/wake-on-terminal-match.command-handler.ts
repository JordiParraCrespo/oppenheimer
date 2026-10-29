import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { UnwatchSessionTerminalCommand } from '../../../sessions/commands/unwatch-session-terminal/unwatch-session-terminal.command';
import { BotSessionWakeResolver } from '../../application/bot-session-wake.resolver';
import { BotSubscriptionSubjectResolver } from '../../application/bot-subscription-subject.resolver';
import { BotSubscriptionMapper } from '../../bot-subscription.mapper';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';
import { BOT_SUBSCRIPTION_WAKE_LIMIT } from '../../domain/bot-subscription.policy';
import { WakeOnTerminalMatchCommand } from './wake-on-terminal-match.command';

/**
 * A session's terminal printed what a bot watches it for
 * (`27-bot-subscriptions.md` §2). The match-specific part of a wake: the
 * report is checked against the count the bot was already woken for, so a
 * report delivered twice or a stale one wakes nothing; the rest is the one
 * wake path (`BotSessionWakeResolver`). Matches count toward the wake limit.
 * A watch nobody follows any more is removed.
 */
@CommandHandler(WakeOnTerminalMatchCommand)
export class WakeOnTerminalMatchCommandHandler
  implements ICommandHandler<WakeOnTerminalMatchCommand, void>
{
  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    private readonly subjects: BotSubscriptionSubjectResolver,
    private readonly wakes: BotSessionWakeResolver,
    private readonly mapper: BotSubscriptionMapper,
    private readonly commands: CommandBus,
  ) {}

  async execute(command: WakeOnTerminalMatchCommand): Promise<void> {
    const { organizationId, sessionId, watchId, count, metadata } = command;
    const subscription = await this.subscriptions.findForTerminalWatch(watchId);
    const watch = subscription?.terminalWatch;
    if (!subscription || !watch) {
      await this.commands.execute(
        new UnwatchSessionTerminalCommand({ organizationId, sessionId, watchId }),
      );
      return;
    }
    if (count <= subscription.matches) return;
    const subject = await this.subjects.resolve(subscription);
    if (!subject) return this.wakes.end(subscription, 'access_lost');
    if (subscription.wakes >= BOT_SUBSCRIPTION_WAKE_LIMIT) {
      return this.wakes.end(subscription, 'wake_limit');
    }

    const ends = subscription.wakes + 1 >= BOT_SUBSCRIPTION_WAKE_LIMIT;
    const wake = this.mapper.toMatchWake(subscription, subject.session, watch, count, ends);
    if ((await this.wakes.queue(subscription, subject, wake, metadata.correlationId)) === 'missing')
      return;
    if (ends) return this.wakes.end(subscription, 'wake_limit');
    subscription.recordMatch(count);
    // A loser was beaten by another wake of the same subscription, which recorded its own.
    await this.subscriptions.recordWake(subscription);
  }
}
