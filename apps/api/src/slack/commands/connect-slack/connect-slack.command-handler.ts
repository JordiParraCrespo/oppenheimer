import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { FindBotQuery } from '../../../bots/queries/find-bot/find-bot.query';
import type { SlackAccountRepositoryPort } from '../../database/slack-account.repository.port';
import { SlackErrors } from '../../domain/slack.errors';
import { SlackAccountEntity, slackTokenHintOf } from '../../domain/slack-account.entity';
import type { SlackSealerPort } from '../../infrastructure/slack-sealer.port';
import type { SlackWebApiPort } from '../../infrastructure/slack-web-api.port';
import { SLACK_ACCOUNT_REPOSITORY, SLACK_SEALER, SLACK_WEB_API } from '../../slack.di-tokens';
import { ConnectSlackCommand } from './connect-slack.command';

/**
 * Connects one of the caller's bots to its own Slack app: Slack is asked whose
 * the bot token is first (`auth.test`), so a token it refuses (`SLACK_004`) is
 * never stored; then the token and the signing secret are sealed and kept,
 * over the bot's earlier ones. The bot is read as the caller, so another
 * person's is not found (`BOTS_001`); a Slack app another bot already is,
 * is refused (`SLACK_005`).
 */
@CommandHandler(ConnectSlackCommand)
export class ConnectSlackCommandHandler
  implements ICommandHandler<ConnectSlackCommand, AggregateID>
{
  constructor(
    @Inject(SLACK_ACCOUNT_REPOSITORY) private readonly accounts: SlackAccountRepositoryPort,
    @Inject(SLACK_SEALER) private readonly sealer: SlackSealerPort,
    @Inject(SLACK_WEB_API) private readonly slack: SlackWebApiPort,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({
    scope,
    botId,
    botToken,
    signingSecret,
  }: ConnectSlackCommand): Promise<AggregateID> {
    const organizationId = scope.organizationId;
    if (!organizationId) throw new AppError(SlackErrors.NO_ACTIVE_ORGANIZATION);
    if (!this.sealer.isConfigured()) throw new AppError(SlackErrors.NOT_CONFIGURED);
    await this.queryBus.execute(new FindBotQuery({ scope, botId }));
    const identity = await this.slack.identify(botToken);
    const credentials = {
      identity,
      sealedBotToken: this.sealer.seal(botToken),
      sealedSigningSecret: this.sealer.seal(signingSecret),
      tokenHint: slackTokenHintOf(botToken),
    };
    const found = await this.accounts.findOwnByBot(scope, botId);
    const account = found.isSome()
      ? found.unwrap()
      : SlackAccountEntity.connect({ organizationId, userId: scope.userId, botId, ...credentials });
    if (found.isSome()) account.replaceCredentials(credentials);
    if ((await this.accounts.put(account)) === 'taken') {
      throw new AppError(SlackErrors.APP_TAKEN, {
        detail: `${identity.botName} in ${identity.teamName} is already another bot’s Slack app. Create a Slack app for this bot.`,
      });
    }
    return account.id;
  }
}
