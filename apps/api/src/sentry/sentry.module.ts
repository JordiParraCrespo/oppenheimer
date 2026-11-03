import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configKeySealer } from '@oppenheimer/backend-core';
import { sentrySealKeyOf } from '../config/sentry.config';
import { InboundEventsModule } from '../inbound-events/inbound-events.module';
import { HandleSentryWebhookCommandHandler } from './commands/handle-sentry-webhook/handle-sentry-webhook.command-handler';
import { HandleSentryWebhookHttpController } from './commands/handle-sentry-webhook/handle-sentry-webhook.http.controller';
import { PutSentryConnectionCommandHandler } from './commands/put-sentry-connection/put-sentry-connection.command-handler';
import { PutSentryConnectionHttpController } from './commands/put-sentry-connection/put-sentry-connection.http.controller';
import { RemoveSentryConnectionCommandHandler } from './commands/remove-sentry-connection/remove-sentry-connection.command-handler';
import { RemoveSentryConnectionHttpController } from './commands/remove-sentry-connection/remove-sentry-connection.http.controller';
import { SentryConnectionOrmEntity } from './database/sentry-connection.orm-entity';
import { SentryConnectionRepository } from './database/sentry-connection.repository';
import { SentryEventSource } from './infrastructure/sentry-event-source.adapter';
import { FindSentryConnectionHttpController } from './queries/find-sentry-connection/find-sentry-connection.http.controller';
import { FindSentryConnectionQueryHandler } from './queries/find-sentry-connection/find-sentry-connection.query-handler';
import { SENTRY_CONNECTION_REPOSITORY, SENTRY_SECRET_SEALER } from './sentry.di-tokens';
import { SentryConnectionMapper } from './sentry-connection.mapper';

const httpControllers = [
  FindSentryConnectionHttpController,
  PutSentryConnectionHttpController,
  RemoveSentryConnectionHttpController,
  HandleSentryWebhookHttpController,
];

const commandHandlers: Provider[] = [
  PutSentryConnectionCommandHandler,
  RemoveSentryConnectionCommandHandler,
  HandleSentryWebhookCommandHandler,
];

const queryHandlers: Provider[] = [FindSentryConnectionQueryHandler];

/**
 * Sentry as a trigger source (`product/next-steps/sentry.md`): the
 * workspace's connected Sentry organization, its webhook, and the hub source
 * that turns an issue or an alert into catalog events an automation or a
 * bot's routine starts on. Not the API's own error reporting, which is
 * `@oppenheimer/backend-error-reporting`.
 */
@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([SentryConnectionOrmEntity]), InboundEventsModule],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    SentryConnectionMapper,
    ...InboundEventsModule.contributeSources([SentryEventSource]),
    { provide: SENTRY_CONNECTION_REPOSITORY, useClass: SentryConnectionRepository },
    configKeySealer(SENTRY_SECRET_SEALER, {
      configKey: 'sentry.sealKey',
      envName: 'SENTRY_CONNECTION_KEY',
      keyOf: sentrySealKeyOf,
    }),
  ],
})
export class SentryModule {}
