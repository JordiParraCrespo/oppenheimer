import { Inject, Injectable } from '@nestjs/common';
import type { SlackAccountRepositoryPort } from '../database/slack-account.repository.port';
import type { SlackAccountEntity } from '../domain/slack-account.entity';
import { SLACK_ACCOUNT_REPOSITORY } from '../slack.di-tokens';

/**
 * The Slack app a bot's turn acts through, while it still may: connected,
 * and still that bot's (not disconnected, nor given to another bot, while the
 * turn ran). Null otherwise, and the caller does nothing in Slack. Every
 * call a turn makes as the app (its answer, its reaction, the images it
 * reads) asks here, so the rule is kept in one place.
 */
@Injectable()
export class SlackBotAppResolver {
  constructor(
    @Inject(SLACK_ACCOUNT_REPOSITORY) private readonly accounts: SlackAccountRepositoryPort,
  ) {}

  async answering(
    organizationId: string,
    accountId: string,
    botId: string,
  ): Promise<SlackAccountEntity | null> {
    const found = await this.accounts.findByIdForSystem(organizationId, accountId);
    if (found.isNone()) return null;
    const account = found.unwrap();
    return account.isConnected && account.botId === botId ? account : null;
  }
}
