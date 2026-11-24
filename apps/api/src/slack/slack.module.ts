import { Module, type NestModule, type Provider } from '@nestjs/common';
import { ApplicationConfig, HttpAdapterHost } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { configKeySealer } from '@oppenheimer/backend-core';
import { slackTokenKeyOf } from '../config/slack.config';
import { SlackBotAppResolver } from './application/slack-bot-app.resolver';
import { SlackLineResolver } from './application/slack-line.resolver';
import { ConnectSlackCommandHandler } from './commands/connect-slack/connect-slack.command-handler';
import { ConnectSlackHttpController } from './commands/connect-slack/connect-slack.http.controller';
import { MarkSlackWorkingCommandHandler } from './commands/mark-slack-working/mark-slack-working.command-handler';
import { OpenSlackOwnerLinkCommandHandler } from './commands/open-slack-owner-link/open-slack-owner-link.command-handler';
import { OpenSlackOwnerLinkHttpController } from './commands/open-slack-owner-link/open-slack-owner-link.http.controller';
import { ReactOnSlackCommandHandler } from './commands/react-on-slack/react-on-slack.command-handler';
import { ReceiveSlackEventCommandHandler } from './commands/receive-slack-event/receive-slack-event.command-handler';
import { ReceiveSlackEventHttpController } from './commands/receive-slack-event/receive-slack-event.http.controller';
import { RemoveSlackAccountCommandHandler } from './commands/remove-slack-account/remove-slack-account.command-handler';
import { RemoveSlackAccountHttpController } from './commands/remove-slack-account/remove-slack-account.http.controller';
import { ReplyOnSlackCommandHandler } from './commands/reply-on-slack/reply-on-slack.command-handler';
import { SlackAccountOrmEntity } from './database/slack-account.orm-entity';
import { SlackAccountRepository } from './database/slack-account.repository';
import { mountSlackEventsBodyParser } from './infrastructure/slack-events-body.util';
import { SlackWebApiGateway } from './infrastructure/slack-web-api.gateway';
import { FindSlackAccountQueryHandler } from './queries/find-slack-account/find-slack-account.query-handler';
import { FindSlackAccountsHttpController } from './queries/find-slack-accounts/find-slack-accounts.http.controller';
import { FindSlackAccountsQueryHandler } from './queries/find-slack-accounts/find-slack-accounts.query-handler';
import { FindSlackAppSetupHttpController } from './queries/find-slack-app-setup/find-slack-app-setup.http.controller';
import { FindSlackAppSetupQueryHandler } from './queries/find-slack-app-setup/find-slack-app-setup.query-handler';
import { FindSlackImagesQueryHandler } from './queries/find-slack-images/find-slack-images.query-handler';
import { SLACK_ACCOUNT_REPOSITORY, SLACK_SEALER, SLACK_WEB_API } from './slack.di-tokens';
import { SlackResource } from './slack.resource';
import { SlackAccountMapper } from './slack-account.mapper';

const httpControllers = [
  FindSlackAccountsHttpController,
  FindSlackAppSetupHttpController,
  ConnectSlackHttpController,
  OpenSlackOwnerLinkHttpController,
  RemoveSlackAccountHttpController,
  ReceiveSlackEventHttpController,
];

/**
 * The end of a Slack turn dispatches its answer (`ReplyOnSlack`, from
 * `bots-chat`), and a bot's `react` its reaction (`ReactOnSlack`).
 */
const commandHandlers: Provider[] = [
  ConnectSlackCommandHandler,
  MarkSlackWorkingCommandHandler,
  ReactOnSlackCommandHandler,
  OpenSlackOwnerLinkCommandHandler,
  RemoveSlackAccountCommandHandler,
  ReceiveSlackEventCommandHandler,
  ReplyOnSlackCommandHandler,
];

const queryHandlers: Provider[] = [
  FindSlackAccountsQueryHandler,
  FindSlackAccountQueryHandler,
  FindSlackAppSetupQueryHandler,
  FindSlackImagesQueryHandler,
];

/**
 * Slack: each bot's own Slack app, so it has its own name and face there. The
 * person creates it from the manifest this module answers, installs it to
 * their Slack workspace and pastes its bot token and signing secret, sealed
 * here; Slack sends the app's events to `POST /v1/slack/events?bot=…`, and
 * the owner's mention or DM wakes the bot (`SlackOwnerWroteDomainEvent`, read
 * by `bots-chat`), which answers in the thread it was asked in.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([SlackAccountOrmEntity]),
    AuthzKernelModule.forFeature([SlackResource]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    SlackAccountMapper,
    SlackLineResolver,
    SlackBotAppResolver,
    { provide: SLACK_ACCOUNT_REPOSITORY, useClass: SlackAccountRepository },
    configKeySealer(SLACK_SEALER, {
      configKey: 'slack.tokenKey',
      envName: 'SLACK_TOKEN_KEY',
      keyOf: slackTokenKeyOf,
    }),
    { provide: SLACK_WEB_API, useClass: SlackWebApiGateway },
  ],
})
export class SlackModule implements NestModule {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly appConfig: ApplicationConfig,
  ) {}

  configure(): void {
    mountSlackEventsBodyParser(
      this.adapterHost,
      this.appConfig,
      ReceiveSlackEventHttpController,
      'receive',
    );
  }
}
