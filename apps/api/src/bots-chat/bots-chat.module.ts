import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createBotEngine } from '@oppenheimer/backend-agents';
import { BotsModule } from '../bots/bots.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { QueueModule } from '../queue/queue.module';
import { BotApprovalRequestFactory } from './application/bot-approval-request.factory';
import { BotApprovedCallResolver } from './application/bot-approved-call.resolver';
import { BotAutomationToolsFactory } from './application/bot-automation-tools.factory';
import { BotPeerToolsFactory } from './application/bot-bots-tools.factory';
import { BotGithubToolsFactory } from './application/bot-github-tools.factory';
import { BotHostToolsFactory } from './application/bot-host-tools.factory';
import { BotOwnerScopeResolver } from './application/bot-owner-scope.resolver';
import { BotPlanToolsFactory } from './application/bot-plan-tools.factory';
import { BotSelfToolsFactory } from './application/bot-self-tools.factory';
import { BotSessionToolsFactory } from './application/bot-session-tools.factory';
import { BotToolboxFactory } from './application/bot-toolbox.factory';
import { BotTurnContextResolver } from './application/bot-turn-context.resolver';
import { BotWebToolsFactory } from './application/bot-web-tools.factory';
import { TurnCancelWatchFactory } from './application/turn-cancel-watch.factory';
import { BotApprovalMapper } from './bot-approval.mapper';
import { BotMessageMapper } from './bot-message.mapper';
import { BotTurnMapper } from './bot-turn.mapper';
import {
  BOT_APPROVAL_REPOSITORY,
  BOT_ENGINE,
  BOT_MESSAGE_REPOSITORY,
  BOT_STREAM,
  BOT_TURN_REPOSITORY,
  OWNER_HOSTS,
  WEB_PAGE,
} from './bots-chat.di-tokens';
import { CancelBotTurnCommandHandler } from './commands/cancel-bot-turn/cancel-bot-turn.command-handler';
import { CancelBotTurnHttpController } from './commands/cancel-bot-turn/cancel-bot-turn.http.controller';
import { DecideBotApprovalCommandHandler } from './commands/decide-bot-approval/decide-bot-approval.command-handler';
import { DecideBotApprovalHttpController } from './commands/decide-bot-approval/decide-bot-approval.http.controller';
import { RunBotTurnCommandHandler } from './commands/run-bot-turn/run-bot-turn.command-handler';
import { SendBotMessageCommandHandler } from './commands/send-bot-message/send-bot-message.command-handler';
import { SendBotMessageHttpController } from './commands/send-bot-message/send-bot-message.http.controller';
import { BotApprovalOrmEntity } from './database/bot-approval.orm-entity';
import { BotApprovalRepository } from './database/bot-approval.repository';
import { BotMessageOrmEntity } from './database/bot-message.orm-entity';
import { BotMessageRepository } from './database/bot-message.repository';
import { BotTurnOrmEntity } from './database/bot-turn.orm-entity';
import { BotTurnRepository } from './database/bot-turn.repository';
import { BotTurnsProcessor } from './infrastructure/bot-turns.processor';
import { GuardedWebPageAdapter } from './infrastructure/guarded-web-page.adapter';
import { QueryBusOwnerHostsAdapter } from './infrastructure/query-bus-owner-hosts.adapter';
import { RedisBotStreamAdapter } from './infrastructure/redis-bot-stream.adapter';
import { FindBotApprovalQueryHandler } from './queries/find-bot-approval/find-bot-approval.query-handler';
import { FindBotApprovalsHttpController } from './queries/find-bot-approvals/find-bot-approvals.http.controller';
import { FindBotApprovalsQueryHandler } from './queries/find-bot-approvals/find-bot-approvals.query-handler';
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
  FindBotApprovalsHttpController,
  DecideBotApprovalHttpController,
];

const commandHandlers: Provider[] = [
  SendBotMessageCommandHandler,
  CancelBotTurnCommandHandler,
  RunBotTurnCommandHandler,
  DecideBotApprovalCommandHandler,
];

const queryHandlers: Provider[] = [
  FindBotTurnQueryHandler,
  FindBotConversationQueryHandler,
  StreamBotQueryHandler,
  FindBotApprovalQueryHandler,
  FindBotApprovalsQueryHandler,
];

/**
 * A bot's chat (`product/versions/mvp/25-bots.md` §2–3): your messages queued
 * as turns, one running per bot, the `bot-turns` worker that runs each on
 * `@oppenheimer/backend-agents`, the conversation they leave, and the live
 * stream a chat follows, and the Needs input cards an asking tool raises and
 * the owner answers. It reads the bot, its documents, its memory and the
 * workspace's provider key through the ports `BotsModule` exports, and serves
 * routes under `/bots/:id` whose last segment no route of that module has.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([BotTurnOrmEntity, BotMessageOrmEntity, BotApprovalOrmEntity]),
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
    BotApprovalMapper,
    BotTurnContextResolver,
    BotApprovalRequestFactory,
    BotApprovedCallResolver,
    BotOwnerScopeResolver,
    BotToolboxFactory,
    BotHostToolsFactory,
    BotSessionToolsFactory,
    BotSelfToolsFactory,
    BotPlanToolsFactory,
    BotGithubToolsFactory,
    BotAutomationToolsFactory,
    BotPeerToolsFactory,
    BotWebToolsFactory,
    { provide: WEB_PAGE, useClass: GuardedWebPageAdapter },
    TurnCancelWatchFactory,
    BotTurnsProcessor,
    { provide: BOT_TURN_REPOSITORY, useClass: BotTurnRepository },
    { provide: BOT_MESSAGE_REPOSITORY, useClass: BotMessageRepository },
    { provide: BOT_APPROVAL_REPOSITORY, useClass: BotApprovalRepository },
    { provide: BOT_STREAM, useClass: RedisBotStreamAdapter },
    { provide: OWNER_HOSTS, useClass: QueryBusOwnerHostsAdapter },
    // The engines load their SDKs on a turn's first use, so binding them starts nothing.
    { provide: BOT_ENGINE, useFactory: () => createBotEngine() },
  ],
})
export class BotsChatModule {}
