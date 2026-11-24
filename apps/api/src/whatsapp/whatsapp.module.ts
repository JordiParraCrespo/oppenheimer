import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { HostsModule } from '../hosts/hosts.module';
import { LinksModule } from '../links/links.module';
import { WhatsappAnswerResolver } from './application/whatsapp-answer.resolver';
import { WhatsappChatResolver } from './application/whatsapp-chat.resolver';
import { WhatsappChatRoutesResolver } from './application/whatsapp-chat-routes.resolver';
import { WhatsappReplyResolver } from './application/whatsapp-reply.resolver';
import { AllowWhatsappChatCommandHandler } from './commands/allow-whatsapp-chat/allow-whatsapp-chat.command-handler';
import { AllowWhatsappChatHttpController } from './commands/allow-whatsapp-chat/allow-whatsapp-chat.http.controller';
import { ConfirmWhatsappOwnerCommandHandler } from './commands/confirm-whatsapp-owner/confirm-whatsapp-owner.command-handler';
import { ConfirmWhatsappOwnerHttpController } from './commands/confirm-whatsapp-owner/confirm-whatsapp-owner.http.controller';
import { LinkWhatsappCommandHandler } from './commands/link-whatsapp/link-whatsapp.command-handler';
import { LinkWhatsappHttpController } from './commands/link-whatsapp/link-whatsapp.http.controller';
import { ReceiveWhatsappMessagesCommandHandler } from './commands/receive-whatsapp-messages/receive-whatsapp-messages.command-handler';
import { RecordWhatsappChatsCommandHandler } from './commands/record-whatsapp-chats/record-whatsapp-chats.command-handler';
import { RecordWhatsappStateCommandHandler } from './commands/record-whatsapp-state/record-whatsapp-state.command-handler';
import { RemoveWhatsappAccountCommandHandler } from './commands/remove-whatsapp-account/remove-whatsapp-account.command-handler';
import { RemoveWhatsappAccountHttpController } from './commands/remove-whatsapp-account/remove-whatsapp-account.http.controller';
import { ReplyOnWhatsappCommandHandler } from './commands/reply-on-whatsapp/reply-on-whatsapp.command-handler';
import { RequestWhatsappOwnerCommandHandler } from './commands/request-whatsapp-owner/request-whatsapp-owner.command-handler';
import { RequestWhatsappOwnerHttpController } from './commands/request-whatsapp-owner/request-whatsapp-owner.http.controller';
import { RevokeWhatsappChatCommandHandler } from './commands/revoke-whatsapp-chat/revoke-whatsapp-chat.command-handler';
import { RevokeWhatsappChatHttpController } from './commands/revoke-whatsapp-chat/revoke-whatsapp-chat.http.controller';
import { RouteWhatsappChatsCommandHandler } from './commands/route-whatsapp-chats/route-whatsapp-chats.command-handler';
import { RouteWhatsappChatsHttpController } from './commands/route-whatsapp-chats/route-whatsapp-chats.http.controller';
import { SeeWhatsappImageCommandHandler } from './commands/see-whatsapp-image/see-whatsapp-image.command-handler';
import { SendWhatsappMessageCommandHandler } from './commands/send-whatsapp-message/send-whatsapp-message.command-handler';
import { TranscribeWhatsappVoiceNoteCommandHandler } from './commands/transcribe-whatsapp-voice-note/transcribe-whatsapp-voice-note.command-handler';
import { UpdateWhatsappAccountCommandHandler } from './commands/update-whatsapp-account/update-whatsapp-account.command-handler';
import { UpdateWhatsappAccountHttpController } from './commands/update-whatsapp-account/update-whatsapp-account.http.controller';
import { UpdateWhatsappChatGrantCommandHandler } from './commands/update-whatsapp-chat-grant/update-whatsapp-chat-grant.command-handler';
import { UpdateWhatsappChatGrantHttpController } from './commands/update-whatsapp-chat-grant/update-whatsapp-chat-grant.http.controller';
import { WhatsappAccountOrmEntity } from './database/whatsapp-account.orm-entity';
import { WhatsappAccountRepository } from './database/whatsapp-account.repository';
import { WhatsappChatGrantOrmEntity } from './database/whatsapp-chat-grant.orm-entity';
import { WhatsappChatGrantRepository } from './database/whatsapp-chat-grant.repository';
import { WhatsappKnownChatOrmEntity } from './database/whatsapp-known-chat.orm-entity';
import { WhatsappKnownChatRepository } from './database/whatsapp-known-chat.repository';
import { WhatsappMessageOrmEntity } from './database/whatsapp-message.orm-entity';
import { WhatsappMessageRepository } from './database/whatsapp-message.repository';
import { OggOpusVoiceNoteDecoderAdapter } from './infrastructure/ogg-opus-voice-note-decoder.adapter';
import { FindWhatsappAccountsHttpController } from './queries/find-whatsapp-accounts/find-whatsapp-accounts.http.controller';
import { FindWhatsappAccountsQueryHandler } from './queries/find-whatsapp-accounts/find-whatsapp-accounts.query-handler';
import { FindWhatsappChatGrantsHttpController } from './queries/find-whatsapp-chat-grants/find-whatsapp-chat-grants.http.controller';
import { FindWhatsappChatGrantsQueryHandler } from './queries/find-whatsapp-chat-grants/find-whatsapp-chat-grants.query-handler';
import { FindWhatsappChatRoutesHttpController } from './queries/find-whatsapp-chat-routes/find-whatsapp-chat-routes.http.controller';
import { FindWhatsappChatRoutesQueryHandler } from './queries/find-whatsapp-chat-routes/find-whatsapp-chat-routes.query-handler';
import { FindWhatsappChatsQueryHandler } from './queries/find-whatsapp-chats/find-whatsapp-chats.query-handler';
import { ReadWhatsappChatQueryHandler } from './queries/read-whatsapp-chat/read-whatsapp-chat.query-handler';
import { SearchWhatsappMessagesQueryHandler } from './queries/search-whatsapp-messages/search-whatsapp-messages.query-handler';
import {
  VOICE_NOTE_DECODER,
  WHATSAPP_ACCOUNT_REPOSITORY,
  WHATSAPP_CHAT_GRANT_REPOSITORY,
  WHATSAPP_KNOWN_CHAT_REPOSITORY,
  WHATSAPP_MESSAGE_REPOSITORY,
} from './whatsapp.di-tokens';
import { WhatsappResource } from './whatsapp.resource';
import { WhatsappAccountMapper } from './whatsapp-account.mapper';
import { WhatsappChatGrantMapper } from './whatsapp-chat-grant.mapper';
import { WhatsappKnownChatMapper } from './whatsapp-known-chat.mapper';
import { WhatsappMessageMapper } from './whatsapp-message.mapper';

const httpControllers = [
  FindWhatsappAccountsHttpController,
  LinkWhatsappHttpController,
  UpdateWhatsappAccountHttpController,
  RequestWhatsappOwnerHttpController,
  ConfirmWhatsappOwnerHttpController,
  RemoveWhatsappAccountHttpController,
  FindWhatsappChatGrantsHttpController,
  FindWhatsappChatRoutesHttpController,
  RouteWhatsappChatsHttpController,
  AllowWhatsappChatHttpController,
  UpdateWhatsappChatGrantHttpController,
  RevokeWhatsappChatHttpController,
];

/**
 * The relay dispatches the host's reports (`RecordWhatsappState`,
 * `RecordWhatsappChats`, `ReceiveWhatsappMessages`); a bot's tools dispatch the send, the end of a
 * WhatsApp turn its reply (`ReplyOnWhatsapp`, from `bots-chat`), and a wake on
 * the owner's voice note its hearing (`TranscribeWhatsappVoiceNote`), and one
 * on an image its fetching (`SeeWhatsappImage`).
 */
const commandHandlers: Provider[] = [
  LinkWhatsappCommandHandler,
  UpdateWhatsappAccountCommandHandler,
  RequestWhatsappOwnerCommandHandler,
  ConfirmWhatsappOwnerCommandHandler,
  ReplyOnWhatsappCommandHandler,
  RemoveWhatsappAccountCommandHandler,
  RecordWhatsappStateCommandHandler,
  RecordWhatsappChatsCommandHandler,
  ReceiveWhatsappMessagesCommandHandler,
  SendWhatsappMessageCommandHandler,
  TranscribeWhatsappVoiceNoteCommandHandler,
  SeeWhatsappImageCommandHandler,
  AllowWhatsappChatCommandHandler,
  UpdateWhatsappChatGrantCommandHandler,
  RouteWhatsappChatsCommandHandler,
  RevokeWhatsappChatCommandHandler,
];

/**
 * The reads a bot's WhatsApp tools dispatch (`bots-chat`'s
 * `BotWhatsappToolsFactory`): no route reaches the chats, so a number's
 * messages are read only by its owner's bots. A number's allowed chats are
 * read by both, Settings and the tools.
 */
const queryHandlers: Provider[] = [
  FindWhatsappAccountsQueryHandler,
  FindWhatsappChatsQueryHandler,
  ReadWhatsappChatQueryHandler,
  SearchWhatsappMessagesQueryHandler,
  FindWhatsappChatGrantsQueryHandler,
  FindWhatsappChatRoutesQueryHandler,
];

/**
 * WhatsApp: a number the person owns, joined as a linked device by the runner
 * on one of their hosts (OpenClaw's route, the WhatsApp Web multi-device
 * protocol), and the messages it sees, kept for their bots. The socket and the
 * keys are the host's; this module reaches them over the runner link
 * (`WHATSAPP_DEVICE`, bound by `links/`).
 */
@Module({
  imports: [
    CqrsModule,
    HostsModule,
    LinksModule,
    TypeOrmModule.forFeature([
      WhatsappAccountOrmEntity,
      WhatsappMessageOrmEntity,
      WhatsappChatGrantOrmEntity,
      WhatsappKnownChatOrmEntity,
    ]),
    AuthzKernelModule.forFeature([WhatsappResource]),
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    WhatsappAccountMapper,
    WhatsappMessageMapper,
    WhatsappChatGrantMapper,
    WhatsappKnownChatMapper,
    WhatsappChatResolver,
    WhatsappChatRoutesResolver,
    WhatsappReplyResolver,
    WhatsappAnswerResolver,
    { provide: WHATSAPP_ACCOUNT_REPOSITORY, useClass: WhatsappAccountRepository },
    { provide: WHATSAPP_MESSAGE_REPOSITORY, useClass: WhatsappMessageRepository },
    { provide: VOICE_NOTE_DECODER, useClass: OggOpusVoiceNoteDecoderAdapter },
    { provide: WHATSAPP_CHAT_GRANT_REPOSITORY, useClass: WhatsappChatGrantRepository },
    { provide: WHATSAPP_KNOWN_CHAT_REPOSITORY, useClass: WhatsappKnownChatRepository },
  ],
})
export class WhatsappModule {}
