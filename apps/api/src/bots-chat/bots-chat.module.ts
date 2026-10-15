import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createBotEngine } from '@oppenheimer/backend-agents';
import { BotsModule } from '../bots/bots.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { QueueModule } from '../queue/queue.module';
import { BotOwnerScopeResolver } from './application/bot-owner-scope.resolver';
import { BotTurnContextResolver } from './application/bot-turn-context.resolver';
import { TurnCancelWatchFactory } from './application/turn-cancel-watch.factory';
import { BotMessageMapper } from './bot-message.mapper';
import { BotTurnMapper } from './bot-turn.mapper';
import {
  BOT_ENGINE,
  BOT_MESSAGE_REPOSITORY,
  BOT_STREAM,
  BOT_TURN_REPOSITORY,
} from './bots-chat.di-tokens';
import { CancelBotTurnCommandHandler } from './commands/cancel-bot-turn/cancel-bot-turn.command-handler';
import { CancelBotTurnHttpController } from './commands/cancel-bot-turn/cancel-bot-turn.http.controller';
import { RunBotTurnCommandHandler } from './commands/run-bot-turn/run-bot-turn.command-handler';
import { SendBotMessageCommandHandler } from './commands/send-bot-message/send-bot-message.command-handler';
import { SendBotMessageHttpController } from './commands/send-bot-message/send-bot-message.http.controller';
import { BotMessageOrmEntity } from './database/bot-message.orm-entity';
import { BotMessageRepository } from './database/bot-message.repository';
import { BotTurnOrmEntity } from './database/bot-turn.orm-entity';
import { BotTurnRepository } from './database/bot-turn.repository';
import { BotTurnsProcessor } from './infrastructure/bot-turns.processor';
import { RedisBotStreamAdapter } from './infrastructure/redis-bot-stream.adapter';
import { FindBotConversationHttpController } from './queries/find-bot-conversation/find-bot-conversation.http.controller';
import { FindBotConversationQueryHandler } from './queries/find-bot-conversation/find-bot-conversation.query-handler';
import { FindBotTurnQueryHandler } from './queries/find-bot-turn/find-bot-turn.query-handler';
import { StreamBotHttpController } from './queries/stream-bot/stream-bot.http.controller';
import { StreamBotQueryHandler } from './queries/stream-bot/stream-bot.query-handler';

const httpControllers = [
  FindBotConversationHttpController,
  SendBotMessageHttpController,
  CancelBotTurnHttpController,
  StreamBotHttpController,
];

const commandHandlers: Provider[] = [
  SendBotMessageCommandHandler,
  CancelBotTurnCommandHandler,
  RunBotTurnCommandHandler,
];

const queryHandlers: Provider[] = [
  FindBotTurnQueryHandler,
  FindBotConversationQueryHandler,
  StreamBotQueryHandler,
];

/**
 * A bot's chat (`product/versions/mvp/25-bots.md` §2–3): your messages queued
 * as turns, one running per bot, the `bot-turns` worker that runs each on
 * `@oppenheimer/backend-agents`, the conversation they leave, and the live
 * stream a chat follows. It reads the bot, its documents, its memory and the
 * workspace's provider key through the ports `BotsModule` exports, and serves
 * routes under `/bots/:id` whose last segment no route of that module has.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([BotTurnOrmEntity, BotMessageOrmEntity]),
    // The `bot-turns` queue the outbox stages each due turn on.
    QueueModule,
    BotsModule,
    // A turn acts as the bot's owner, who must still be a member.
    OrganizationsModule,
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    BotTurnMapper,
    BotMessageMapper,
    BotTurnContextResolver,
    BotOwnerScopeResolver,
    TurnCancelWatchFactory,
    BotTurnsProcessor,
    { provide: BOT_TURN_REPOSITORY, useClass: BotTurnRepository },
    { provide: BOT_MESSAGE_REPOSITORY, useClass: BotMessageRepository },
    { provide: BOT_STREAM, useClass: RedisBotStreamAdapter },
    // The engines load their SDKs on a turn's first use, so binding them starts nothing.
    { provide: BOT_ENGINE, useFactory: () => createBotEngine() },
  ],
})
export class BotsChatModule {}
