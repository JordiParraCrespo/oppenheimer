import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { HostsModule } from '../hosts/hosts.module';
import { LinksModule } from '../links/links.module';
import { TelegramChatResolver } from './application/telegram-chat.resolver';
import { LinkTelegramCommandHandler } from './commands/link-telegram/link-telegram.command-handler';
import { LinkTelegramHttpController } from './commands/link-telegram/link-telegram.http.controller';
import { ReceiveTelegramMessagesCommandHandler } from './commands/receive-telegram-messages/receive-telegram-messages.command-handler';
import { RecordTelegramStateCommandHandler } from './commands/record-telegram-state/record-telegram-state.command-handler';
import { RemoveTelegramAccountCommandHandler } from './commands/remove-telegram-account/remove-telegram-account.command-handler';
import { RemoveTelegramAccountHttpController } from './commands/remove-telegram-account/remove-telegram-account.http.controller';
import { SendTelegramMessageCommandHandler } from './commands/send-telegram-message/send-telegram-message.command-handler';
import { TelegramAccountOrmEntity } from './database/telegram-account.orm-entity';
import { TelegramAccountRepository } from './database/telegram-account.repository';
import { TelegramMessageOrmEntity } from './database/telegram-message.orm-entity';
import { TelegramMessageRepository } from './database/telegram-message.repository';
import { FindTelegramAccountsHttpController } from './queries/find-telegram-accounts/find-telegram-accounts.http.controller';
import { FindTelegramAccountsQueryHandler } from './queries/find-telegram-accounts/find-telegram-accounts.query-handler';
import { FindTelegramChatsQueryHandler } from './queries/find-telegram-chats/find-telegram-chats.query-handler';
import { ReadTelegramChatQueryHandler } from './queries/read-telegram-chat/read-telegram-chat.query-handler';
import { SearchTelegramMessagesQueryHandler } from './queries/search-telegram-messages/search-telegram-messages.query-handler';
import { TELEGRAM_ACCOUNT_REPOSITORY, TELEGRAM_MESSAGE_REPOSITORY } from './telegram.di-tokens';
import { TelegramResource } from './telegram.resource';
import { TelegramAccountMapper } from './telegram-account.mapper';
import { TelegramMessageMapper } from './telegram-message.mapper';

const httpControllers = [
  FindTelegramAccountsHttpController,
  LinkTelegramHttpController,
  RemoveTelegramAccountHttpController,
];

/**
 * The relay dispatches the host's reports (`RecordTelegramState`,
 * `ReceiveTelegramMessages`); a bot's tools dispatch the send.
 */
const commandHandlers: Provider[] = [
  LinkTelegramCommandHandler,
  RemoveTelegramAccountCommandHandler,
  RecordTelegramStateCommandHandler,
  ReceiveTelegramMessagesCommandHandler,
  SendTelegramMessageCommandHandler,
];

/**
 * The reads a bot's Telegram tools dispatch (`bots-chat`'s
 * `BotTelegramToolsFactory`): no route reaches the chats, so a Telegram bot's
 * messages are read only by its owner's bots.
 */
const queryHandlers: Provider[] = [
  FindTelegramAccountsQueryHandler,
  FindTelegramChatsQueryHandler,
  ReadTelegramChatQueryHandler,
  SearchTelegramMessagesQueryHandler,
];

/**
 * Telegram (`product/next-steps/telegram.md`): a bot the person made with
 * @BotFather, long-polled on the Bot API by the runner on one of their hosts
 * (OpenClaw's route, on WhatsApp's gateway), and the messages it receives,
 * kept for their Oppenheimer bots. The token and the poller are the host's;
 * this module reaches them over the runner link (`TELEGRAM_DEVICE`, bound by
 * `links/`).
 */
@Module({
  imports: [
    CqrsModule,
    HostsModule,
    LinksModule,
    TypeOrmModule.forFeature([TelegramAccountOrmEntity, TelegramMessageOrmEntity]),
    AuthzKernelModule.forFeature([TelegramResource]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    TelegramAccountMapper,
    TelegramMessageMapper,
    TelegramChatResolver,
    { provide: TELEGRAM_ACCOUNT_REPOSITORY, useClass: TelegramAccountRepository },
    { provide: TELEGRAM_MESSAGE_REPOSITORY, useClass: TelegramMessageRepository },
  ],
})
export class TelegramModule {}
