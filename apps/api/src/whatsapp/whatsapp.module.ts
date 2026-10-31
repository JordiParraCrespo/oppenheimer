import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { HostsModule } from '../hosts/hosts.module';
import { LinksModule } from '../links/links.module';
import { WhatsappChatResolver } from './application/whatsapp-chat.resolver';
import { LinkWhatsappCommandHandler } from './commands/link-whatsapp/link-whatsapp.command-handler';
import { LinkWhatsappHttpController } from './commands/link-whatsapp/link-whatsapp.http.controller';
import { ReceiveWhatsappMessagesCommandHandler } from './commands/receive-whatsapp-messages/receive-whatsapp-messages.command-handler';
import { RecordWhatsappStateCommandHandler } from './commands/record-whatsapp-state/record-whatsapp-state.command-handler';
import { RemoveWhatsappAccountCommandHandler } from './commands/remove-whatsapp-account/remove-whatsapp-account.command-handler';
import { RemoveWhatsappAccountHttpController } from './commands/remove-whatsapp-account/remove-whatsapp-account.http.controller';
import { SendWhatsappMessageCommandHandler } from './commands/send-whatsapp-message/send-whatsapp-message.command-handler';
import { WhatsappAccountOrmEntity } from './database/whatsapp-account.orm-entity';
import { WhatsappAccountRepository } from './database/whatsapp-account.repository';
import { WhatsappMessageOrmEntity } from './database/whatsapp-message.orm-entity';
import { WhatsappMessageRepository } from './database/whatsapp-message.repository';
import { FindWhatsappAccountsHttpController } from './queries/find-whatsapp-accounts/find-whatsapp-accounts.http.controller';
import { FindWhatsappAccountsQueryHandler } from './queries/find-whatsapp-accounts/find-whatsapp-accounts.query-handler';
import { FindWhatsappChatsQueryHandler } from './queries/find-whatsapp-chats/find-whatsapp-chats.query-handler';
import { ReadWhatsappChatQueryHandler } from './queries/read-whatsapp-chat/read-whatsapp-chat.query-handler';
import { SearchWhatsappMessagesQueryHandler } from './queries/search-whatsapp-messages/search-whatsapp-messages.query-handler';
import { WHATSAPP_ACCOUNT_REPOSITORY, WHATSAPP_MESSAGE_REPOSITORY } from './whatsapp.di-tokens';
import { WhatsappResource } from './whatsapp.resource';
import { WhatsappAccountMapper } from './whatsapp-account.mapper';
import { WhatsappMessageMapper } from './whatsapp-message.mapper';

const httpControllers = [
  FindWhatsappAccountsHttpController,
  LinkWhatsappHttpController,
  RemoveWhatsappAccountHttpController,
];

/**
 * The relay dispatches the host's reports (`RecordWhatsappState`,
 * `ReceiveWhatsappMessages`); a bot's tools dispatch the send.
 */
const commandHandlers: Provider[] = [
  LinkWhatsappCommandHandler,
  RemoveWhatsappAccountCommandHandler,
  RecordWhatsappStateCommandHandler,
  ReceiveWhatsappMessagesCommandHandler,
  SendWhatsappMessageCommandHandler,
];

/**
 * The reads a bot's WhatsApp tools dispatch (`bots-chat`'s
 * `BotWhatsappToolsFactory`): no route reaches the chats, so a number's
 * messages are read only by its owner's bots.
 */
const queryHandlers: Provider[] = [
  FindWhatsappAccountsQueryHandler,
  FindWhatsappChatsQueryHandler,
  ReadWhatsappChatQueryHandler,
  SearchWhatsappMessagesQueryHandler,
];

/**
 * WhatsApp (`product/next-steps/whatsapp.md`): a number the person owns,
 * joined as a linked device by the runner on one of their hosts (OpenClaw's
 * route, the WhatsApp Web multi-device protocol), and the messages it sees,
 * kept for their bots. The socket and the keys are the host's; this module
 * reaches them over the runner link (`WHATSAPP_DEVICE`, bound by `links/`).
 */
@Module({
  imports: [
    CqrsModule,
    HostsModule,
    LinksModule,
    TypeOrmModule.forFeature([WhatsappAccountOrmEntity, WhatsappMessageOrmEntity]),
    AuthzKernelModule.forFeature([WhatsappResource]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    WhatsappAccountMapper,
    WhatsappMessageMapper,
    WhatsappChatResolver,
    { provide: WHATSAPP_ACCOUNT_REPOSITORY, useClass: WhatsappAccountRepository },
    { provide: WHATSAPP_MESSAGE_REPOSITORY, useClass: WhatsappMessageRepository },
  ],
})
export class WhatsappModule {}
