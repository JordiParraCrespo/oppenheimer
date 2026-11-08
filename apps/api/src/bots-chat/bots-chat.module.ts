import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createBotEngine } from '@oppenheimer/backend-agents';
import { AutomationsModule } from '../automations/automations.module';
import { BotsModule } from '../bots/bots.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProfileModule } from '../profile/profile.module';
import { QueueModule } from '../queue/queue.module';
import { BotApprovalRequestFactory } from './application/bot-approval-request.factory';
import { BotApprovalStartedPolicy } from './application/bot-approval-started.policy';
import { BotApprovedCallResolver } from './application/bot-approved-call.resolver';
import { BotAutomationToolsFactory } from './application/bot-automation-tools.factory';
import { BotPeerToolsFactory } from './application/bot-bots-tools.factory';
import { BotCompletionResolver } from './application/bot-completion.resolver';
import { BotDreamResolver } from './application/bot-dream.resolver';
import { BotDreamTriggerPolicy } from './application/bot-dream-trigger.policy';
import { BotGithubToolsFactory } from './application/bot-github-tools.factory';
import { BotGoalResolver } from './application/bot-goal.resolver';
import { BotGoalReviewResolver } from './application/bot-goal-review.resolver';
import { BotGoalToolsFactory } from './application/bot-goal-tools.factory';
import { BotGuideToolsFactory } from './application/bot-guide-tools.factory';
import { BotHostCommandToolsFactory } from './application/bot-host-command-tools.factory';
import { BotHostTargetResolver } from './application/bot-host-target.resolver';
import { BotHostToolsFactory } from './application/bot-host-tools.factory';
import { BotIssueToolsFactory } from './application/bot-issue-tools.factory';
import { BotLoopResolver } from './application/bot-loop.resolver';
import { BotLoopToolsFactory } from './application/bot-loop-tools.factory';
import { BotMailAccountsResolver } from './application/bot-mail-accounts.resolver';
import { BotMailChatFilesResolver } from './application/bot-mail-chat-files.resolver';
import { BotMailOrganizeToolsFactory } from './application/bot-mail-organize-tools.factory';
import { BotMailToolsFactory } from './application/bot-mail-tools.factory';
import { BotMailWriteToolsFactory } from './application/bot-mail-write-tools.factory';
import { BotMessageAttachmentsResolver } from './application/bot-message-attachments.resolver';
import { BotModelAccessResolver } from './application/bot-model-access.resolver';
import { BotNoticeToolsFactory } from './application/bot-notice-tools.factory';
import { BotOwnerPermissionsResolver } from './application/bot-owner-permissions.resolver';
import { BotOwnerScopeResolver } from './application/bot-owner-scope.resolver';
import { BotPermissionsResolver } from './application/bot-permissions.resolver';
import { BotPlanToolsFactory } from './application/bot-plan-tools.factory';
import { BotProjectToolsFactory } from './application/bot-project-tools.factory';
import { BotPullRequestToolsFactory } from './application/bot-pull-request-tools.factory';
import { BotPullRequestWatchResolver } from './application/bot-pull-request-watch.resolver';
import { BotPullRequestWatchToolsFactory } from './application/bot-pull-request-watch-tools.factory';
import { BotQuestionDecisionResolver } from './application/bot-question-decision.resolver';
import { BotQuestionToolsFactory } from './application/bot-question-tools.factory';
import { BotRoutineToolsFactory } from './application/bot-routine-tools.factory';
import { BotRuleReviewerFactory } from './application/bot-rule-reviewer.factory';
import { BotSelfToolsFactory } from './application/bot-self-tools.factory';
import { BotSentTurnResolver } from './application/bot-sent-turn.resolver';
import { BotSessionFileToolsFactory } from './application/bot-session-file-tools.factory';
import { BotSessionToolsFactory } from './application/bot-session-tools.factory';
import { BotSessionWaitResolver } from './application/bot-session-wait.resolver';
import { BotSessionWakeResolver } from './application/bot-session-wake.resolver';
import { BotSessionWatchResolver } from './application/bot-session-watch.resolver';
import { BotSkillToolsFactory } from './application/bot-skill-tools.factory';
import { BotSteeringFactory } from './application/bot-steering.factory';
import { BotSubagentRunnerFactory } from './application/bot-subagent-runner.factory';
import { BotSubagentToolsFactory } from './application/bot-subagent-tools.factory';
import { BotSubscriptionSubjectResolver } from './application/bot-subscription-subject.resolver';
import { BotSummaryTriggerPolicy } from './application/bot-summary-trigger.policy';
import { BotTelegramToolsFactory } from './application/bot-telegram-tools.factory';
import { BotTerminalToolsFactory } from './application/bot-terminal-tools.factory';
import { BotToolboxFactory } from './application/bot-toolbox.factory';
import { BotTurnContextResolver } from './application/bot-turn-context.resolver';
import { BotTurnFailureReportPolicy } from './application/bot-turn-failure-report.policy';
import { BotTurnOpeningResolver } from './application/bot-turn-opening.resolver';
import { BotWaitingCardResolver } from './application/bot-waiting-card.resolver';
import { BotWatchToolsFactory } from './application/bot-watch-tools.factory';
import { BotWebToolsFactory } from './application/bot-web-tools.factory';
import { BotWhatsappToolsFactory } from './application/bot-whatsapp-tools.factory';
import { BotHeartbeatDomainEventHandler } from './application/event-handlers/bot-heartbeat.domain-event-handler';
import { BotPullRequestWakeDomainEventHandler } from './application/event-handlers/bot-pull-request-wake.domain-event-handler';
import { BotRoutineActivityDomainEventHandler } from './application/event-handlers/bot-routine-activity.domain-event-handler';
import { BotSessionWakeDomainEventHandler } from './application/event-handlers/bot-session-wake.domain-event-handler';
import { BotUnattendedRoutinesDomainEventHandler } from './application/event-handlers/bot-unattended-routines.domain-event-handler';
import { TurnCancelWatchFactory } from './application/turn-cancel-watch.factory';
import { TurnWriteFactory } from './application/turn-write.factory';
import { BotApprovalMapper } from './bot-approval.mapper';
import { BotAttachmentMapper } from './bot-attachment.mapper';
import { BotConversationSummaryMapper } from './bot-conversation-summary.mapper';
import { BotGoalMapper } from './bot-goal.mapper';
import { BotLoopMapper } from './bot-loop.mapper';
import { BotMemoryDreamMapper } from './bot-memory-dream.mapper';
import { BotMessageMapper } from './bot-message.mapper';
import { BotNoticeMapper } from './bot-notice.mapper';
import { BotPermissionRuleMapper } from './bot-permission-rule.mapper';
import { BotQuestionMapper } from './bot-question.mapper';
import { BotSubscriptionMapper } from './bot-subscription.mapper';
import { BotToolPermissionMapper } from './bot-tool-permission.mapper';
import { BotTurnMapper } from './bot-turn.mapper';
import { BotUsageMapper } from './bot-usage.mapper';
import {
  BOT_APPROVAL_REPOSITORY,
  BOT_ATTACHMENT_FILES,
  BOT_ATTACHMENT_REPOSITORY,
  BOT_CONVERSATION_REPOSITORY,
  BOT_CONVERSATION_SUMMARY_REPOSITORY,
  BOT_ENGINE,
  BOT_GOAL_REPOSITORY,
  BOT_LOOP_REPOSITORY,
  BOT_MEMORY_DREAM_REPOSITORY,
  BOT_MESSAGE_REPOSITORY,
  BOT_NOTICE_REPOSITORY,
  BOT_PERMISSION_RULE_REPOSITORY,
  BOT_QUESTION_REPOSITORY,
  BOT_STALL_CHECKS,
  BOT_STREAM,
  BOT_SUBSCRIPTION_REPOSITORY,
  BOT_TOOL_PERMISSION_REPOSITORY,
  BOT_TURN_REPOSITORY,
  BOT_USAGE_REPOSITORY,
  OWNER_HOSTS,
  WEB_PAGE,
} from './bots-chat.di-tokens';
import { AnswerBotQuestionCommandHandler } from './commands/answer-bot-question/answer-bot-question.command-handler';
import { AnswerBotQuestionHttpController } from './commands/answer-bot-question/answer-bot-question.http.controller';
import { CancelBotTurnCommandHandler } from './commands/cancel-bot-turn/cancel-bot-turn.command-handler';
import { CancelBotTurnHttpController } from './commands/cancel-bot-turn/cancel-bot-turn.http.controller';
import { CheckStalledSessionCommandHandler } from './commands/check-stalled-session/check-stalled-session.command-handler';
import { ClearBotConversationCommandHandler } from './commands/clear-bot-conversation/clear-bot-conversation.command-handler';
import { ClearBotConversationHttpController } from './commands/clear-bot-conversation/clear-bot-conversation.http.controller';
import { ClearBotGoalCommandHandler } from './commands/clear-bot-goal/clear-bot-goal.command-handler';
import { ClearBotGoalHttpController } from './commands/clear-bot-goal/clear-bot-goal.http.controller';
import { ClearBotLoopCommandHandler } from './commands/clear-bot-loop/clear-bot-loop.command-handler';
import { ClearBotLoopHttpController } from './commands/clear-bot-loop/clear-bot-loop.http.controller';
import { ContinueBotGoalCommandHandler } from './commands/continue-bot-goal/continue-bot-goal.command-handler';
import { CreateBotPermissionRuleCommandHandler } from './commands/create-bot-permission-rule/create-bot-permission-rule.command-handler';
import { CreateBotPermissionRuleHttpController } from './commands/create-bot-permission-rule/create-bot-permission-rule.http.controller';
import { DecideBotApprovalCommandHandler } from './commands/decide-bot-approval/decide-bot-approval.command-handler';
import { DecideBotApprovalHttpController } from './commands/decide-bot-approval/decide-bot-approval.http.controller';
import { DeleteBotPermissionRuleCommandHandler } from './commands/delete-bot-permission-rule/delete-bot-permission-rule.command-handler';
import { DeleteBotPermissionRuleHttpController } from './commands/delete-bot-permission-rule/delete-bot-permission-rule.http.controller';
import { DeleteBotToolGrantCommandHandler } from './commands/delete-bot-tool-grant/delete-bot-tool-grant.command-handler';
import { DeleteBotToolGrantHttpController } from './commands/delete-bot-tool-grant/delete-bot-tool-grant.http.controller';
import { DeliverBotAnswerCommandHandler } from './commands/deliver-bot-answer/deliver-bot-answer.command-handler';
import { DismissBotQuestionCommandHandler } from './commands/dismiss-bot-question/dismiss-bot-question.command-handler';
import { DismissBotQuestionHttpController } from './commands/dismiss-bot-question/dismiss-bot-question.http.controller';
import { DreamBotMemoryCommandHandler } from './commands/dream-bot-memory/dream-bot-memory.command-handler';
import { FinishBotLoopRunCommandHandler } from './commands/finish-bot-loop-run/finish-bot-loop-run.command-handler';
import { RequestBotMemoryDreamCommandHandler } from './commands/request-bot-memory-dream/request-bot-memory-dream.command-handler';
import { RequestBotMemoryDreamHttpController } from './commands/request-bot-memory-dream/request-bot-memory-dream.http.controller';
import { RunApprovedCallCommandHandler } from './commands/run-approved-call/run-approved-call.command-handler';
import { RunBotLoopCommandHandler } from './commands/run-bot-loop/run-bot-loop.command-handler';
import { RunBotTurnCommandHandler } from './commands/run-bot-turn/run-bot-turn.command-handler';
import { SendBotMessageCommandHandler } from './commands/send-bot-message/send-bot-message.command-handler';
import { SendBotMessageHttpController } from './commands/send-bot-message/send-bot-message.http.controller';
import { SendBotPeerMessageCommandHandler } from './commands/send-bot-peer-message/send-bot-peer-message.command-handler';
import { SetBotToolDecisionCommandHandler } from './commands/set-bot-tool-decision/set-bot-tool-decision.command-handler';
import { SetBotToolDecisionHttpController } from './commands/set-bot-tool-decision/set-bot-tool-decision.http.controller';
import { SummarizeBotConversationCommandHandler } from './commands/summarize-bot-conversation/summarize-bot-conversation.command-handler';
import { UndoBotMemoryDreamCommandHandler } from './commands/undo-bot-memory-dream/undo-bot-memory-dream.command-handler';
import { UndoBotMemoryDreamHttpController } from './commands/undo-bot-memory-dream/undo-bot-memory-dream.http.controller';
import { UploadBotAttachmentCommandHandler } from './commands/upload-bot-attachment/upload-bot-attachment.command-handler';
import { UploadBotAttachmentHttpController } from './commands/upload-bot-attachment/upload-bot-attachment.http.controller';
import { WakeOnAgentNoticeCommandHandler } from './commands/wake-on-agent-notice/wake-on-agent-notice.command-handler';
import { WakeOnPullRequestCommandHandler } from './commands/wake-on-pull-request/wake-on-pull-request.command-handler';
import { WakeOnTerminalMatchCommandHandler } from './commands/wake-on-terminal-match/wake-on-terminal-match.command-handler';
import { WakeSubscribedBotCommandHandler } from './commands/wake-subscribed-bot/wake-subscribed-bot.command-handler';
import { BotApprovalOrmEntity } from './database/bot-approval.orm-entity';
import { BotApprovalRepository } from './database/bot-approval.repository';
import { BotAttachmentOrmEntity } from './database/bot-attachment.orm-entity';
import { BotAttachmentRepository } from './database/bot-attachment.repository';
import { BotConversationRepository } from './database/bot-conversation.repository';
import { BotConversationSummaryOrmEntity } from './database/bot-conversation-summary.orm-entity';
import { BotConversationSummaryRepository } from './database/bot-conversation-summary.repository';
import { BotGoalOrmEntity } from './database/bot-goal.orm-entity';
import { BotGoalRepository } from './database/bot-goal.repository';
import { BotLoopOrmEntity } from './database/bot-loop.orm-entity';
import { BotLoopRepository } from './database/bot-loop.repository';
import { BotMemoryDreamOrmEntity } from './database/bot-memory-dream.orm-entity';
import { BotMemoryDreamRepository } from './database/bot-memory-dream.repository';
import { BotMessageOrmEntity } from './database/bot-message.orm-entity';
import { BotMessageRepository } from './database/bot-message.repository';
import { BotModelCallOrmEntity } from './database/bot-model-call.orm-entity';
import { BotNoticeOrmEntity } from './database/bot-notice.orm-entity';
import { BotNoticeRepository } from './database/bot-notice.repository';
import { BotPermissionRuleOrmEntity } from './database/bot-permission-rule.orm-entity';
import { BotPermissionRuleRepository } from './database/bot-permission-rule.repository';
import { BotQuestionOrmEntity } from './database/bot-question.orm-entity';
import { BotQuestionRepository } from './database/bot-question.repository';
import { BotSubscriptionOrmEntity } from './database/bot-subscription.orm-entity';
import { BotSubscriptionRepository } from './database/bot-subscription.repository';
import { BotToolPermissionOrmEntity } from './database/bot-tool-permission.orm-entity';
import { BotToolPermissionRepository } from './database/bot-tool-permission.repository';
import { BotTurnOrmEntity } from './database/bot-turn.orm-entity';
import { BotTurnRepository } from './database/bot-turn.repository';
import { BotUsageRepository } from './database/bot-usage.repository';
import { BotApprovalsProcessor } from './infrastructure/bot-approvals.processor';
import { BotAttachmentRetentionProcessor } from './infrastructure/bot-attachment-retention.processor';
import { BotDreamsProcessor } from './infrastructure/bot-dreams.processor';
import { BotRoutineTarget } from './infrastructure/bot-routine-target.adapter';
import { BotStallChecksProcessor } from './infrastructure/bot-stall-checks.processor';
import { BotSummariesProcessor } from './infrastructure/bot-summaries.processor';
import { BotTurnsProcessor } from './infrastructure/bot-turns.processor';
import { GuardedWebPageAdapter } from './infrastructure/guarded-web-page.adapter';
import { OutboxBotStallChecksAdapter } from './infrastructure/outbox-bot-stall-checks.adapter';
import { QueryBusOwnerHostsAdapter } from './infrastructure/query-bus-owner-hosts.adapter';
import { RedisBotStreamAdapter } from './infrastructure/redis-bot-stream.adapter';
import { StorageBotAttachmentFilesAdapter } from './infrastructure/storage-bot-attachment-files.adapter';
import { ExportBotConversationHttpController } from './queries/export-bot-conversation/export-bot-conversation.http.controller';
import { ExportBotConversationQueryHandler } from './queries/export-bot-conversation/export-bot-conversation.query-handler';
import { FindBotApprovalQueryHandler } from './queries/find-bot-approval/find-bot-approval.query-handler';
import { FindBotApprovalsHttpController } from './queries/find-bot-approvals/find-bot-approvals.http.controller';
import { FindBotApprovalsQueryHandler } from './queries/find-bot-approvals/find-bot-approvals.query-handler';
import { FindBotAttachmentQueryHandler } from './queries/find-bot-attachment/find-bot-attachment.query-handler';
import { FindBotConversationHttpController } from './queries/find-bot-conversation/find-bot-conversation.http.controller';
import { FindBotConversationQueryHandler } from './queries/find-bot-conversation/find-bot-conversation.query-handler';
import { FindBotGoalHttpController } from './queries/find-bot-goal/find-bot-goal.http.controller';
import { FindBotGoalQueryHandler } from './queries/find-bot-goal/find-bot-goal.query-handler';
import { FindBotLoopHttpController } from './queries/find-bot-loop/find-bot-loop.http.controller';
import { FindBotLoopQueryHandler } from './queries/find-bot-loop/find-bot-loop.query-handler';
import { FindBotMemoryDreamHttpController } from './queries/find-bot-memory-dream/find-bot-memory-dream.http.controller';
import { FindBotMemoryDreamQueryHandler } from './queries/find-bot-memory-dream/find-bot-memory-dream.query-handler';
import { FindBotPermissionsHttpController } from './queries/find-bot-permissions/find-bot-permissions.http.controller';
import { FindBotPermissionsQueryHandler } from './queries/find-bot-permissions/find-bot-permissions.query-handler';
import { FindBotQuestionQueryHandler } from './queries/find-bot-question/find-bot-question.query-handler';
import { FindBotTurnQueryHandler } from './queries/find-bot-turn/find-bot-turn.query-handler';
import { FindBotUsageHttpController } from './queries/find-bot-usage/find-bot-usage.http.controller';
import { FindBotUsageQueryHandler } from './queries/find-bot-usage/find-bot-usage.query-handler';
import { FindPendingBotQuestionHttpController } from './queries/find-pending-bot-question/find-pending-bot-question.http.controller';
import { FindPendingBotQuestionQueryHandler } from './queries/find-pending-bot-question/find-pending-bot-question.query-handler';
import { FindWorkspaceBotApprovalsHttpController } from './queries/find-workspace-bot-approvals/find-workspace-bot-approvals.http.controller';
import { FindWorkspaceBotApprovalsQueryHandler } from './queries/find-workspace-bot-approvals/find-workspace-bot-approvals.query-handler';
import { FindWorkspaceBotNoticesHttpController } from './queries/find-workspace-bot-notices/find-workspace-bot-notices.http.controller';
import { FindWorkspaceBotNoticesQueryHandler } from './queries/find-workspace-bot-notices/find-workspace-bot-notices.query-handler';
import { ReadBotAttachmentHttpController } from './queries/read-bot-attachment/read-bot-attachment.http.controller';
import { ReadBotAttachmentQueryHandler } from './queries/read-bot-attachment/read-bot-attachment.query-handler';
import { SearchBotConversationQueryHandler } from './queries/search-bot-conversation/search-bot-conversation.query-handler';
import { StreamBotHttpController } from './queries/stream-bot/stream-bot.http.controller';
import { StreamBotQueryHandler } from './queries/stream-bot/stream-bot.query-handler';

const httpControllers = [
  ExportBotConversationHttpController,
  FindBotConversationHttpController,
  ClearBotConversationHttpController,
  SendBotMessageHttpController,
  UploadBotAttachmentHttpController,
  ReadBotAttachmentHttpController,
  CancelBotTurnHttpController,
  ClearBotGoalHttpController,
  FindBotGoalHttpController,
  ClearBotLoopHttpController,
  FindBotLoopHttpController,
  FindBotUsageHttpController,
  FindBotMemoryDreamHttpController,
  RequestBotMemoryDreamHttpController,
  UndoBotMemoryDreamHttpController,
  StreamBotHttpController,
  FindBotApprovalsHttpController,
  FindWorkspaceBotApprovalsHttpController,
  FindWorkspaceBotNoticesHttpController,
  DecideBotApprovalHttpController,
  FindPendingBotQuestionHttpController,
  AnswerBotQuestionHttpController,
  DismissBotQuestionHttpController,
  FindBotPermissionsHttpController,
  SetBotToolDecisionHttpController,
  CreateBotPermissionRuleHttpController,
  DeleteBotPermissionRuleHttpController,
  DeleteBotToolGrantHttpController,
];

const commandHandlers: Provider[] = [
  SendBotMessageCommandHandler,
  UploadBotAttachmentCommandHandler,
  SendBotPeerMessageCommandHandler,
  DeliverBotAnswerCommandHandler,
  CancelBotTurnCommandHandler,
  ClearBotConversationCommandHandler,
  RunBotTurnCommandHandler,
  DecideBotApprovalCommandHandler,
  AnswerBotQuestionCommandHandler,
  DismissBotQuestionCommandHandler,
  RunApprovedCallCommandHandler,
  SummarizeBotConversationCommandHandler,
  DreamBotMemoryCommandHandler,
  RequestBotMemoryDreamCommandHandler,
  UndoBotMemoryDreamCommandHandler,
  WakeSubscribedBotCommandHandler,
  CheckStalledSessionCommandHandler,
  WakeOnAgentNoticeCommandHandler,
  WakeOnTerminalMatchCommandHandler,
  WakeOnPullRequestCommandHandler,
  ContinueBotGoalCommandHandler,
  ClearBotGoalCommandHandler,
  FindBotGoalQueryHandler,
  RunBotLoopCommandHandler,
  FinishBotLoopRunCommandHandler,
  ClearBotLoopCommandHandler,
  FindBotLoopQueryHandler,
  FindBotUsageQueryHandler,
  SetBotToolDecisionCommandHandler,
  CreateBotPermissionRuleCommandHandler,
  DeleteBotPermissionRuleCommandHandler,
  DeleteBotToolGrantCommandHandler,
];

const queryHandlers: Provider[] = [
  FindBotMemoryDreamQueryHandler,
  FindBotTurnQueryHandler,
  SearchBotConversationQueryHandler,
  FindBotConversationQueryHandler,
  ExportBotConversationQueryHandler,
  StreamBotQueryHandler,
  FindBotApprovalQueryHandler,
  FindBotQuestionQueryHandler,
  FindPendingBotQuestionQueryHandler,
  FindBotApprovalsQueryHandler,
  FindWorkspaceBotApprovalsQueryHandler,
  FindWorkspaceBotNoticesQueryHandler,
  FindBotAttachmentQueryHandler,
  ReadBotAttachmentQueryHandler,
  FindBotPermissionsQueryHandler,
];

/**
 * A bot's chat (`product/versions/mvp/25-bots.md` §2–3): your messages queued
 * as turns, one running per bot, the `bot-turns` worker that runs each on
 * `@oppenheimer/backend-agents`, the conversation they leave, the live
 * stream a chat follows, the Needs input cards an asking tool raises and the
 * owner answers, and the summary that stands in for a long conversation's
 * oldest messages, written by the `bot-summaries` worker; and the sessions
 * a bot follows, whose news wakes it, and the `bot-stall-checks` worker
 * that checks a handed-off task got going (`27-bot-subscriptions.md`). It reads the bot,
 * its documents, its memory and the workspace's provider key through the
 * ports `BotsModule` exports, and serves routes under `/bots/:id` whose last
 * segment no route of that module has.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      BotTurnOrmEntity,
      BotMessageOrmEntity,
      BotApprovalOrmEntity,
      BotQuestionOrmEntity,
      BotNoticeOrmEntity,
      BotConversationSummaryOrmEntity,
      BotMemoryDreamOrmEntity,
      BotAttachmentOrmEntity,
      BotSubscriptionOrmEntity,
      BotGoalOrmEntity,
      BotLoopOrmEntity,
      BotModelCallOrmEntity,
      BotToolPermissionOrmEntity,
      BotPermissionRuleOrmEntity,
    ]),
    // The `bot-turns` queue the outbox stages each due turn on.
    QueueModule,
    BotsModule,
    // A routine is an automation whose run is a turn of its bot: this module
    // contributes that run target (`BotRoutineTarget`).
    AutomationsModule,
    // `LOCALE_RESOLVER`: what the bot says on its owner's behalf is in their language.
    ProfileModule,
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
    BotQuestionMapper,
    BotNoticeMapper,
    BotToolPermissionMapper,
    BotPermissionRuleMapper,
    BotConversationSummaryMapper,
    BotMemoryDreamMapper,
    BotAttachmentMapper,
    BotSubscriptionMapper,
    BotGoalMapper,
    BotLoopMapper,
    BotUsageMapper,
    BotTurnContextResolver,
    BotTurnOpeningResolver,
    BotApprovalStartedPolicy,
    BotMessageAttachmentsResolver,
    BotSteeringFactory,
    TurnWriteFactory,
    BotTurnFailureReportPolicy,
    BotSummaryTriggerPolicy,
    BotDreamTriggerPolicy,
    BotDreamResolver,
    BotModelAccessResolver,
    BotApprovalRequestFactory,
    BotQuestionDecisionResolver,
    BotWaitingCardResolver,
    BotApprovedCallResolver,
    BotOwnerScopeResolver,
    BotPermissionsResolver,
    BotRuleReviewerFactory,
    BotOwnerPermissionsResolver,
    BotToolboxFactory,
    BotHostToolsFactory,
    BotHostCommandToolsFactory,
    BotHostTargetResolver,
    BotTerminalToolsFactory,
    BotSessionFileToolsFactory,
    BotSessionToolsFactory,
    BotSessionWatchResolver,
    BotPullRequestWatchResolver,
    BotSessionWakeResolver,
    BotSessionWaitResolver,
    BotSubscriptionSubjectResolver,
    BotWatchToolsFactory,
    BotGoalToolsFactory,
    BotLoopToolsFactory,
    BotQuestionToolsFactory,
    BotNoticeToolsFactory,
    BotGoalResolver,
    BotLoopResolver,
    BotSentTurnResolver,
    BotGoalReviewResolver,
    BotCompletionResolver,
    BotSelfToolsFactory,
    BotSkillToolsFactory,
    BotGuideToolsFactory,
    BotPlanToolsFactory,
    BotProjectToolsFactory,
    BotGithubToolsFactory,
    BotPullRequestToolsFactory,
    BotPullRequestWatchToolsFactory,
    BotIssueToolsFactory,
    BotAutomationToolsFactory,
    BotRoutineToolsFactory,
    BotPeerToolsFactory,
    BotWebToolsFactory,
    BotMailToolsFactory,
    BotWhatsappToolsFactory,
    BotTelegramToolsFactory,
    BotMailWriteToolsFactory,
    BotMailOrganizeToolsFactory,
    BotMailAccountsResolver,
    BotMailChatFilesResolver,
    BotSubagentToolsFactory,
    BotSubagentRunnerFactory,
    { provide: WEB_PAGE, useClass: GuardedWebPageAdapter },
    ...AutomationsModule.contributeRunTargets([BotRoutineTarget]),
    BotHeartbeatDomainEventHandler,
    BotRoutineActivityDomainEventHandler,
    BotUnattendedRoutinesDomainEventHandler,
    BotSessionWakeDomainEventHandler,
    BotPullRequestWakeDomainEventHandler,
    TurnCancelWatchFactory,
    BotTurnsProcessor,
    BotApprovalsProcessor,
    BotSummariesProcessor,
    BotDreamsProcessor,
    BotStallChecksProcessor,
    BotAttachmentRetentionProcessor,
    { provide: BOT_TURN_REPOSITORY, useClass: BotTurnRepository },
    { provide: BOT_MESSAGE_REPOSITORY, useClass: BotMessageRepository },
    { provide: BOT_APPROVAL_REPOSITORY, useClass: BotApprovalRepository },
    { provide: BOT_QUESTION_REPOSITORY, useClass: BotQuestionRepository },
    { provide: BOT_NOTICE_REPOSITORY, useClass: BotNoticeRepository },
    { provide: BOT_CONVERSATION_REPOSITORY, useClass: BotConversationRepository },
    { provide: BOT_CONVERSATION_SUMMARY_REPOSITORY, useClass: BotConversationSummaryRepository },
    { provide: BOT_MEMORY_DREAM_REPOSITORY, useClass: BotMemoryDreamRepository },
    { provide: BOT_STREAM, useClass: RedisBotStreamAdapter },
    { provide: BOT_ATTACHMENT_REPOSITORY, useClass: BotAttachmentRepository },
    { provide: BOT_SUBSCRIPTION_REPOSITORY, useClass: BotSubscriptionRepository },
    { provide: BOT_STALL_CHECKS, useClass: OutboxBotStallChecksAdapter },
    { provide: BOT_GOAL_REPOSITORY, useClass: BotGoalRepository },
    { provide: BOT_LOOP_REPOSITORY, useClass: BotLoopRepository },
    { provide: BOT_USAGE_REPOSITORY, useClass: BotUsageRepository },
    { provide: BOT_TOOL_PERMISSION_REPOSITORY, useClass: BotToolPermissionRepository },
    { provide: BOT_PERMISSION_RULE_REPOSITORY, useClass: BotPermissionRuleRepository },
    { provide: BOT_ATTACHMENT_FILES, useClass: StorageBotAttachmentFilesAdapter },
    { provide: OWNER_HOSTS, useClass: QueryBusOwnerHostsAdapter },
    // The engines load their SDKs on a turn's first use, so binding them starts nothing.
    { provide: BOT_ENGINE, useFactory: () => createBotEngine() },
  ],
})
export class BotsChatModule {}
