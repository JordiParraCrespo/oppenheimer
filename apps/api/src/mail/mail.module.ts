import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { GmailCallResolver } from './application/gmail-call.resolver';
import { GmailConnectStateResolver } from './application/gmail-connect-state.resolver';
import { ConnectGmailCommandHandler } from './commands/connect-gmail/connect-gmail.command-handler';
import { ConnectGmailHttpController } from './commands/connect-gmail/connect-gmail.http.controller';
import { RemoveGmailConnectionCommandHandler } from './commands/remove-gmail-connection/remove-gmail-connection.command-handler';
import { RemoveGmailConnectionHttpController } from './commands/remove-gmail-connection/remove-gmail-connection.http.controller';
import { StartGmailConnectionCommandHandler } from './commands/start-gmail-connection/start-gmail-connection.command-handler';
import { StartGmailConnectionHttpController } from './commands/start-gmail-connection/start-gmail-connection.http.controller';
import { UpdateGmailConnectionCommandHandler } from './commands/update-gmail-connection/update-gmail-connection.command-handler';
import { UpdateGmailConnectionHttpController } from './commands/update-gmail-connection/update-gmail-connection.http.controller';
import { GmailConnectionOrmEntity } from './database/gmail-connection.orm-entity';
import { GmailConnectionRepository } from './database/gmail-connection.repository';
import { GmailConnectionMapper } from './gmail-connection.mapper';
import { AesTokenSealerAdapter } from './infrastructure/aes-token-sealer.adapter';
import { DocumentAttachmentReaderAdapter } from './infrastructure/document-attachment-reader.adapter';
import { GmailGateway } from './infrastructure/gmail.gateway';
import {
  ATTACHMENT_READER,
  GMAIL_CONNECTION_REPOSITORY,
  GMAIL_PROVIDER,
  MAIL_TOKEN_SEALER,
} from './mail.di-tokens';
import { MailResource } from './mail.resource';
import { FindGmailConnectionQueryHandler } from './queries/find-gmail-connection/find-gmail-connection.query-handler';
import { FindGmailConnectionsHttpController } from './queries/find-gmail-connections/find-gmail-connections.http.controller';
import { FindGmailConnectionsQueryHandler } from './queries/find-gmail-connections/find-gmail-connections.query-handler';
import { FindMailDraftsQueryHandler } from './queries/find-mail-drafts/find-mail-drafts.query-handler';
import { FindMailLabelsQueryHandler } from './queries/find-mail-labels/find-mail-labels.query-handler';
import { ReadMailAttachmentQueryHandler } from './queries/read-mail-attachment/read-mail-attachment.query-handler';
import { ReadMailThreadQueryHandler } from './queries/read-mail-thread/read-mail-thread.query-handler';
import { SearchMailQueryHandler } from './queries/search-mail/search-mail.query-handler';

const httpControllers = [
  FindGmailConnectionsHttpController,
  StartGmailConnectionHttpController,
  ConnectGmailHttpController,
  UpdateGmailConnectionHttpController,
  RemoveGmailConnectionHttpController,
];

const commandHandlers: Provider[] = [
  StartGmailConnectionCommandHandler,
  ConnectGmailCommandHandler,
  UpdateGmailConnectionCommandHandler,
  RemoveGmailConnectionCommandHandler,
];

/**
 * The reads a bot's mail tools dispatch (`bots-chat`'s `BotMailToolsFactory`):
 * no route reaches them, so a mailbox is read only by its owner's bots.
 */
const queryHandlers: Provider[] = [
  FindGmailConnectionQueryHandler,
  FindGmailConnectionsQueryHandler,
  SearchMailQueryHandler,
  ReadMailThreadQueryHandler,
  FindMailLabelsQueryHandler,
  FindMailDraftsQueryHandler,
  ReadMailAttachmentQueryHandler,
];

/**
 * Mail (`product/next-steps/mail.md`): a person's own Gmail accounts, up to
 * five, connected with a grant of their own and worked by their bots. Nothing
 * of a mailbox is stored: every read goes to Gmail when a bot asks.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([GmailConnectionOrmEntity]),
    AuthzKernelModule.forFeature([MailResource]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    GmailConnectionMapper,
    GmailConnectStateResolver,
    GmailCallResolver,
    { provide: GMAIL_CONNECTION_REPOSITORY, useClass: GmailConnectionRepository },
    { provide: GMAIL_PROVIDER, useClass: GmailGateway },
    { provide: MAIL_TOKEN_SEALER, useClass: AesTokenSealerAdapter },
    { provide: ATTACHMENT_READER, useClass: DocumentAttachmentReaderAdapter },
  ],
})
export class MailModule {}
