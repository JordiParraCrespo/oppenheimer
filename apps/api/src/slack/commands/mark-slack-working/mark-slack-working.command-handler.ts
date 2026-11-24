import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SlackLineResolver } from '../../application/slack-line.resolver';
import type { SlackAccountRepositoryPort } from '../../database/slack-account.repository.port';
import { slackThreadOf } from '../../domain/slack-text.policy';
import { SLACK_ACCOUNT_REPOSITORY } from '../../slack.di-tokens';
import { MarkSlackWorkingCommand } from './mark-slack-working.command';

/**
 * Puts the working reaction on the message a turn started on, while the app
 * is connected and still this bot's; otherwise nothing. The reaction is not
 * waited on and never fails the turn.
 */
@CommandHandler(MarkSlackWorkingCommand)
export class MarkSlackWorkingCommandHandler
  implements ICommandHandler<MarkSlackWorkingCommand, void>
{
  constructor(
    @Inject(SLACK_ACCOUNT_REPOSITORY) private readonly accounts: SlackAccountRepositoryPort,
    private readonly lines: SlackLineResolver,
  ) {}

  async execute(command: MarkSlackWorkingCommand): Promise<void> {
    const found = await this.accounts.findByIdForSystem(command.organizationId, command.accountId);
    const thread = slackThreadOf(command.chatId);
    if (found.isNone() || !thread) return;
    const account = found.unwrap();
    if (!account.isConnected || account.botId !== command.botId) return;
    this.lines.working(account, { channel: thread.channel, ts: command.ts }, true);
  }
}
