import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { SlackAccountRepositoryPort } from '../../database/slack-account.repository.port';
import { SLACK_ACCOUNT_REPOSITORY } from '../../slack.di-tokens';
import { RemoveSlackAccountCommand } from './remove-slack-account.command';

/**
 * Forgets a bot's Slack app: its sealed token and secret go, so events Slack
 * still sends it are refused unread, and the bot's Slack threads stay in its
 * history with nowhere to answer. The app stays in Slack: delete it there to
 * end it. An id that is not one of the caller's does nothing.
 */
@CommandHandler(RemoveSlackAccountCommand)
export class RemoveSlackAccountCommandHandler
  implements ICommandHandler<RemoveSlackAccountCommand, void>
{
  constructor(
    @Inject(SLACK_ACCOUNT_REPOSITORY) private readonly accounts: SlackAccountRepositoryPort,
  ) {}

  async execute({ scope, accountId }: RemoveSlackAccountCommand): Promise<void> {
    const found = await this.accounts.findOwnById(scope, accountId);
    if (found.isSome()) await this.accounts.delete(found.unwrap());
  }
}
