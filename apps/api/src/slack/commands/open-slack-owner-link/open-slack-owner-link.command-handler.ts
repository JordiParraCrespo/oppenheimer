import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SlackAccountRepositoryPort } from '../../database/slack-account.repository.port';
import { SlackErrors } from '../../domain/slack.errors';
import { SLACK_ACCOUNT_REPOSITORY } from '../../slack.di-tokens';
import {
  type OpenedSlackOwnerLink,
  OpenSlackOwnerLinkCommand,
} from './open-slack-owner-link.command';

/**
 * A one-time code for one of the caller's bots' Slack apps: whoever sends
 * `link <code>` to the app in its DM within ten minutes is recorded as the
 * owner, the only Slack user the bot answers. A new code replaces the open one.
 */
@CommandHandler(OpenSlackOwnerLinkCommand)
export class OpenSlackOwnerLinkCommandHandler
  implements ICommandHandler<OpenSlackOwnerLinkCommand, OpenedSlackOwnerLink>
{
  constructor(
    @Inject(SLACK_ACCOUNT_REPOSITORY) private readonly accounts: SlackAccountRepositoryPort,
  ) {}

  async execute({ scope, accountId }: OpenSlackOwnerLinkCommand): Promise<OpenedSlackOwnerLink> {
    const found = await this.accounts.findOwnById(scope, accountId);
    if (found.isNone()) {
      throw new AppError(SlackErrors.ACCOUNT_NOT_FOUND, { extensions: { accountId } });
    }
    const account = found.unwrap();
    const { code, expiresAt } = account.openOwnerLink(new Date());
    await this.accounts.saveOwnerLink(account);
    const dm = new URLSearchParams({ channel: account.botUserId, team: account.teamId });
    return {
      message: `link ${code}`,
      url: `https://slack.com/app_redirect?${dm.toString()}`,
      expiresAt,
    };
  }
}
