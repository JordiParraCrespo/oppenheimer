import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SlackBotAppResolver } from '../../application/slack-bot-app.resolver';
import { SlackLineResolver } from '../../application/slack-line.resolver';
import { slackThreadOf } from '../../domain/slack-text.policy';
import { MarkSlackWorkingCommand } from './mark-slack-working.command';

/**
 * Puts the working reaction on the message a turn started on, or takes it
 * off when the turn ended, while the app still answers for this bot
 * (`SlackBotAppResolver`); otherwise nothing. Answers once Slack did, and
 * never throws for the reaction: it never fails the turn.
 */
@CommandHandler(MarkSlackWorkingCommand)
export class MarkSlackWorkingCommandHandler
  implements ICommandHandler<MarkSlackWorkingCommand, void>
{
  constructor(
    private readonly apps: SlackBotAppResolver,
    private readonly lines: SlackLineResolver,
  ) {}

  async execute(command: MarkSlackWorkingCommand): Promise<void> {
    const thread = slackThreadOf(command.chatId);
    if (!thread) return;
    const account = await this.apps.answering(
      command.organizationId,
      command.accountId,
      command.botId,
    );
    if (!account) return;
    await this.lines.setWorking(
      account,
      { channel: thread.channel, ts: command.ts },
      command.working,
    );
  }
}
