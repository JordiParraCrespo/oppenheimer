import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { CloudAgentsModule } from '../cloud-agents/cloud-agents.module';
import { GithubModule } from '../github/github.module';
import { HostsModule } from '../hosts/hosts.module';
import { LinksModule } from '../links/links.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/user.module';
import { AttachTicketFactory } from './application/attach-ticket.factory';
import { CloudSessionSyncResolver } from './application/cloud-session-sync.resolver';
import { HostUnpairedStopsSessionsDomainEventHandler } from './application/event-handlers/host-unpaired.domain-event-handler';
import { HostUnpairedClosesSessionsDomainEventHandler } from './application/event-handlers/host-unpaired-wipe.domain-event-handler';
import { RecordSessionEventsResolver } from './application/record-session-events.resolver';
import { SessionAccountErasure } from './application/session-account-erasure.resolver';
import { SessionAttachmentsResolver } from './application/session-attachments.resolver';
import { SessionHostUsage } from './application/session-host-usage.resolver';
import { SessionLaunchSpecFactory } from './application/session-launch.factory';
import { SessionLoaderResolver } from './application/session-loader.resolver';
import { SessionLookupResolver } from './application/session-lookup.resolver';
import { SessionNamingResolver } from './application/session-naming.resolver';
import { SessionPlanFactory } from './application/session-plan.factory';
import { SessionProjectUsage } from './application/session-project-usage.resolver';
import { SessionReconciliationResolver } from './application/session-reconciliation.resolver';
import { SessionShareAccessResolver } from './application/session-share-access.resolver';
import { AddCheckoutCommandHandler } from './commands/add-checkout/add-checkout.command-handler';
import { AddCheckoutHttpController } from './commands/add-checkout/add-checkout.http.controller';
import { AnswerSessionDecisionCommandHandler } from './commands/answer-session-decision/answer-session-decision.command-handler';
import { AnswerSessionDecisionHttpController } from './commands/answer-session-decision/answer-session-decision.http.controller';
import { CloseSessionCommandHandler } from './commands/close-session/close-session.command-handler';
import { CloseSessionHttpController } from './commands/close-session/close-session.http.controller';
import { CreateSessionCommandHandler } from './commands/create-session/create-session.command-handler';
import { CreateSessionHttpController } from './commands/create-session/create-session.http.controller';
import { IssueAttachTicketCommandHandler } from './commands/issue-attach-ticket/issue-attach-ticket.command-handler';
import { IssueAttachTicketHttpController } from './commands/issue-attach-ticket/issue-attach-ticket.http.controller';
import { IssueSharedAttachTicketCommandHandler } from './commands/issue-shared-attach-ticket/issue-shared-attach-ticket.command-handler';
import { IssueSharedAttachTicketHttpController } from './commands/issue-shared-attach-ticket/issue-shared-attach-ticket.http.controller';
import { MoveSessionCommandHandler } from './commands/move-session/move-session.command-handler';
import { MoveSessionHttpController } from './commands/move-session/move-session.http.controller';
import { PasteSessionImageCommandHandler } from './commands/paste-session-image/paste-session-image.command-handler';
import { PasteSessionImageHttpController } from './commands/paste-session-image/paste-session-image.http.controller';
import { PrepareSessionCommandHandler } from './commands/prepare-session/prepare-session.command-handler';
import { PrepareSessionHttpController } from './commands/prepare-session/prepare-session.http.controller';
import { PutSessionShareCommandHandler } from './commands/put-session-share/put-session-share.command-handler';
import { PutSessionShareHttpController } from './commands/put-session-share/put-session-share.http.controller';
import { RecordSessionEventsCommandHandler } from './commands/record-session-events/record-session-events.command-handler';
import { RemoveCheckoutCommandHandler } from './commands/remove-checkout/remove-checkout.command-handler';
import { RemoveCheckoutHttpController } from './commands/remove-checkout/remove-checkout.http.controller';
import { RenameSessionCommandHandler } from './commands/rename-session/rename-session.command-handler';
import { RenameSessionHttpController } from './commands/rename-session/rename-session.http.controller';
import { RestartSessionCommandHandler } from './commands/restart-session/restart-session.command-handler';
import { RestartSessionHttpController } from './commands/restart-session/restart-session.http.controller';
import { SetSessionSharePeopleCommandHandler } from './commands/set-session-share-people/set-session-share-people.command-handler';
import { SetSessionSharePeopleHttpController } from './commands/set-session-share-people/set-session-share-people.http.controller';
import { StartCloudSessionCommandHandler } from './commands/start-cloud-session/start-cloud-session.command-handler';
import { StartCloudSessionHttpController } from './commands/start-cloud-session/start-cloud-session.http.controller';
import { StopSessionCommandHandler } from './commands/stop-session/stop-session.command-handler';
import { StopSessionHttpController } from './commands/stop-session/stop-session.http.controller';
import { StopSessionShareCommandHandler } from './commands/stop-session-share/stop-session-share.command-handler';
import { StopSessionShareHttpController } from './commands/stop-session-share/stop-session-share.http.controller';
import { UploadSessionAttachmentCommandHandler } from './commands/upload-session-attachment/upload-session-attachment.command-handler';
import { UploadSessionAttachmentHttpController } from './commands/upload-session-attachment/upload-session-attachment.http.controller';
import { SessionCheckoutOrmEntity } from './database/session-checkout.orm-entity';
import { SessionCloudRunOrmEntity } from './database/session-cloud-run.orm-entity';
import { SessionShareOrmEntity } from './database/session-share.orm-entity';
import { SessionShareRepository } from './database/session-share.repository';
import { SessionTurnOrmEntity } from './database/session-turn.orm-entity';
import { SessionUsageRepository } from './database/session-usage.repository';
import { WorkSessionOrmEntity } from './database/work-session.orm-entity';
import { WorkSessionRepository } from './database/work-session.repository';
import { WorkSessionEventOrmEntity } from './database/work-session-event.orm-entity';
import { FindHostFoldersHttpController } from './queries/find-host-folders/find-host-folders.http.controller';
import { FindHostFoldersQueryHandler } from './queries/find-host-folders/find-host-folders.query-handler';
import { FindSessionHttpController } from './queries/find-session/find-session.http.controller';
import { FindSessionQueryHandler } from './queries/find-session/find-session.query-handler';
import { FindSessionEventsHttpController } from './queries/find-session-events/find-session-events.http.controller';
import { FindSessionEventsQueryHandler } from './queries/find-session-events/find-session-events.query-handler';
import { FindSessionShareHttpController } from './queries/find-session-share/find-session-share.http.controller';
import { FindSessionShareQueryHandler } from './queries/find-session-share/find-session-share.query-handler';
import { FindSessionsHttpController } from './queries/find-sessions/find-sessions.http.controller';
import { FindSessionsQueryHandler } from './queries/find-sessions/find-sessions.query-handler';
import { FindSharedSessionHttpController } from './queries/find-shared-session/find-shared-session.http.controller';
import { FindSharedSessionQueryHandler } from './queries/find-shared-session/find-shared-session.query-handler';
import { SessionShareMapper } from './session-share.mapper';
import {
  RECORD_SESSION_EVENTS,
  SESSION_LOOKUP,
  SESSION_RECONCILIATION,
  SESSION_SHARE_REPOSITORY,
  SESSION_USAGE_READER,
  WORK_SESSION_REPOSITORY,
} from './sessions.di-tokens';
import { SessionResource } from './sessions.resource';
import { WorkSessionMapper } from './work-session.mapper';

/**
 * Registration order matters: every static path is registered before `:id`, or
 * `GET /sessions` would be answered by the detail route with "sessions" as an id.
 * Within the parameterized ones, the longer paths come first for the same reason.
 */
const httpControllers = [
  // `shared-sessions/*`: a guest's two routes, under a path of their own.
  FindSharedSessionHttpController,
  IssueSharedAttachTicketHttpController,
  FindSessionsHttpController,
  CreateSessionHttpController,
  StartCloudSessionHttpController,
  UploadSessionAttachmentHttpController,
  FindSessionEventsHttpController,
  IssueAttachTicketHttpController,
  SetSessionSharePeopleHttpController,
  FindSessionShareHttpController,
  PutSessionShareHttpController,
  StopSessionShareHttpController,
  PasteSessionImageHttpController,
  AnswerSessionDecisionHttpController,
  StopSessionHttpController,
  PrepareSessionHttpController,
  RestartSessionHttpController,
  AddCheckoutHttpController,
  RemoveCheckoutHttpController,
  FindSessionHttpController,
  RenameSessionHttpController,
  MoveSessionHttpController,
  CloseSessionHttpController,
  // `hosts/:id/folders`: the folder picker, here because its recent folders are sessions.
  FindHostFoldersHttpController,
];

const commandHandlers: Provider[] = [
  CreateSessionCommandHandler,
  StartCloudSessionCommandHandler,
  RenameSessionCommandHandler,
  MoveSessionCommandHandler,
  StopSessionCommandHandler,
  PrepareSessionCommandHandler,
  RestartSessionCommandHandler,
  CloseSessionCommandHandler,
  AddCheckoutCommandHandler,
  RemoveCheckoutCommandHandler,
  IssueAttachTicketCommandHandler,
  PutSessionShareCommandHandler,
  SetSessionSharePeopleCommandHandler,
  StopSessionShareCommandHandler,
  IssueSharedAttachTicketCommandHandler,
  PasteSessionImageCommandHandler,
  AnswerSessionDecisionCommandHandler,
  UploadSessionAttachmentCommandHandler,
  RecordSessionEventsCommandHandler,
];

const queryHandlers: Provider[] = [
  FindSessionsQueryHandler,
  FindSessionQueryHandler,
  FindSessionEventsQueryHandler,
  FindSessionShareQueryHandler,
  FindSharedSessionQueryHandler,
  FindHostFoldersQueryHandler,
];

const adapters: Provider[] = [
  { provide: RECORD_SESSION_EVENTS, useClass: RecordSessionEventsResolver },
  { provide: SESSION_LOOKUP, useClass: SessionLookupResolver },
  { provide: SESSION_RECONCILIATION, useClass: SessionReconciliationResolver },
  { provide: SESSION_USAGE_READER, useClass: SessionUsageRepository },
];

/** Sessions: the row, its checkouts, its append-only log and the fold of that log. */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      WorkSessionOrmEntity,
      SessionCheckoutOrmEntity,
      WorkSessionEventOrmEntity,
      SessionTurnOrmEntity,
      SessionShareOrmEntity,
      SessionCloudRunOrmEntity,
    ]),
    AuthzKernelModule.forFeature([SessionResource]),
    // The three modules this one is built on, imported rather than assumed: the
    // project a session belongs to, the machine it may run on, and what a
    // repository is called. The edges that run the other way — "is this project
    // still in use", "what runs on this host" — are contributed from this module's
    // own providers, so neither module has to import this one.
    ProjectsModule,
    HostsModule,
    GithubModule,
    // `SESSION_DISPATCH` and `HOST_FOLDERS` are bound there: the dispatcher and
    // the folder lister over the runner link.
    // Importing it is what makes the port's implementation the relay's rather
    // than this module's, without this module knowing a socket exists.
    LinksModule,
    // The workspace's slug for a launch and the workspaces an account owns for
    // its erasure, and nothing else of organizations'.
    OrganizationsModule,
    // `CLOUD_RUNS`: what a cloud session asks its vendor, on its launcher's key.
    CloudAgentsModule,
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...adapters,
    WorkSessionMapper,
    SessionShareMapper,
    AttachTicketFactory,
    CloudSessionSyncResolver,
    SessionShareAccessResolver,
    SessionPlanFactory,
    SessionLaunchSpecFactory,
    SessionNamingResolver,
    SessionLoaderResolver,
    SessionAttachmentsResolver,
    // Contributed rather than exported: the implementation is built here, in this
    // module's injector, so it injects this module's repository port while
    // `projects/` reaches across only for the registry.
    ...ProjectsModule.contributeUsage([SessionProjectUsage]),
    // The same shape for hosts: what runs on a machine, for its row in Settings.
    ...HostsModule.contributeUsage([SessionHostUsage]),
    ...UsersModule.contributeAccountErasure([SessionAccountErasure]),
    HostUnpairedStopsSessionsDomainEventHandler,
    HostUnpairedClosesSessionsDomainEventHandler,
    { provide: WORK_SESSION_REPOSITORY, useClass: WorkSessionRepository },
    { provide: SESSION_SHARE_REPOSITORY, useClass: SessionShareRepository },
  ],
  // The three application ports and the usage read, and nothing else. The
  // repository is this module's persistence adapter: publishing it would let the
  // next slice read and append past `RECORD_SESSION_EVENTS`, which is the door
  // that checks the host. The usage reader only aggregates, so it can be handed out.
  exports: [RECORD_SESSION_EVENTS, SESSION_LOOKUP, SESSION_RECONCILIATION, SESSION_USAGE_READER],
})
export class SessionsModule {}
