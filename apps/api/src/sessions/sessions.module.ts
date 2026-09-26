import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { GithubModule } from '../github/github.module';
import { HostsModule } from '../hosts/hosts.module';
import { LinksModule } from '../links/links.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProjectsModule } from '../projects/projects.module';
import { RecordSessionEventsResolver } from './application/record-session-events.resolver';
import { SessionLaunchSpecFactory } from './application/session-launch.factory';
import { SessionLookupResolver } from './application/session-lookup.resolver';
import { SessionNamingResolver } from './application/session-naming.resolver';
import { SessionPlanFactory } from './application/session-plan.factory';
import { SessionProjectUsage } from './application/session-project-usage.resolver';
import { SessionReconciliationResolver } from './application/session-reconciliation.resolver';
import { AddCheckoutCommandHandler } from './commands/add-checkout/add-checkout.command-handler';
import { AddCheckoutHttpController } from './commands/add-checkout/add-checkout.http.controller';
import { CloseSessionCommandHandler } from './commands/close-session/close-session.command-handler';
import { CloseSessionHttpController } from './commands/close-session/close-session.http.controller';
import { CreateSessionCommandHandler } from './commands/create-session/create-session.command-handler';
import { CreateSessionHttpController } from './commands/create-session/create-session.http.controller';
import { IssueAttachTicketCommandHandler } from './commands/issue-attach-ticket/issue-attach-ticket.command-handler';
import { IssueAttachTicketHttpController } from './commands/issue-attach-ticket/issue-attach-ticket.http.controller';
import { PasteSessionImageCommandHandler } from './commands/paste-session-image/paste-session-image.command-handler';
import { PasteSessionImageHttpController } from './commands/paste-session-image/paste-session-image.http.controller';
import { RecordSessionEventsCommandHandler } from './commands/record-session-events/record-session-events.command-handler';
import { RemoveCheckoutCommandHandler } from './commands/remove-checkout/remove-checkout.command-handler';
import { RemoveCheckoutHttpController } from './commands/remove-checkout/remove-checkout.http.controller';
import { MoveSessionCommandHandler } from './commands/move-session/move-session.command-handler';
import { MoveSessionHttpController } from './commands/move-session/move-session.http.controller';
import { RenameSessionCommandHandler } from './commands/rename-session/rename-session.command-handler';
import { RenameSessionHttpController } from './commands/rename-session/rename-session.http.controller';
import { RestartSessionCommandHandler } from './commands/restart-session/restart-session.command-handler';
import { RestartSessionHttpController } from './commands/restart-session/restart-session.http.controller';
import { StopSessionCommandHandler } from './commands/stop-session/stop-session.command-handler';
import { StopSessionHttpController } from './commands/stop-session/stop-session.http.controller';
import { SessionCheckoutOrmEntity } from './database/session-checkout.orm-entity';
import { WorkSessionOrmEntity } from './database/work-session.orm-entity';
import { WorkSessionRepository } from './database/work-session.repository';
import { WorkSessionEventOrmEntity } from './database/work-session-event.orm-entity';
import { FindSessionHttpController } from './queries/find-session/find-session.http.controller';
import { FindSessionQueryHandler } from './queries/find-session/find-session.query-handler';
import { FindSessionEventsHttpController } from './queries/find-session-events/find-session-events.http.controller';
import { FindSessionEventsQueryHandler } from './queries/find-session-events/find-session-events.query-handler';
import { FindSessionsHttpController } from './queries/find-sessions/find-sessions.http.controller';
import { FindSessionsQueryHandler } from './queries/find-sessions/find-sessions.query-handler';
import {
  RECORD_SESSION_EVENTS,
  SESSION_LOOKUP,
  SESSION_RECONCILIATION,
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
  FindSessionsHttpController,
  CreateSessionHttpController,
  FindSessionEventsHttpController,
  IssueAttachTicketHttpController,
  PasteSessionImageHttpController,
  StopSessionHttpController,
  RestartSessionHttpController,
  AddCheckoutHttpController,
  RemoveCheckoutHttpController,
  FindSessionHttpController,
  RenameSessionHttpController,
  MoveSessionHttpController,
  CloseSessionHttpController,
];

const commandHandlers: Provider[] = [
  CreateSessionCommandHandler,
  RenameSessionCommandHandler,
  MoveSessionCommandHandler,
  StopSessionCommandHandler,
  RestartSessionCommandHandler,
  CloseSessionCommandHandler,
  AddCheckoutCommandHandler,
  RemoveCheckoutCommandHandler,
  IssueAttachTicketCommandHandler,
  PasteSessionImageCommandHandler,
  RecordSessionEventsCommandHandler,
];

const queryHandlers: Provider[] = [
  FindSessionsQueryHandler,
  FindSessionQueryHandler,
  FindSessionEventsQueryHandler,
];

const adapters: Provider[] = [
  { provide: RECORD_SESSION_EVENTS, useClass: RecordSessionEventsResolver },
  { provide: SESSION_LOOKUP, useClass: SessionLookupResolver },
  { provide: SESSION_RECONCILIATION, useClass: SessionReconciliationResolver },
];

/**
 * Sessions: the row, its checkouts, its append-only log and the fold of that log.
 *
 * It is the module the other three feed into. `projects/` answers which body of work
 * a session belongs to (and creates one on a repository's first session), `hosts/`
 * answers whether the caller may put work on a machine, and `github/` answers what a
 * repository is called and mints the token to check it out.
 *
 * Two ports go the other way, for the module that will own the runner link:
 * `SESSION_DISPATCH` to send a session's work to a host, and
 * `RECORD_SESSION_EVENTS` to write what the host reports back. They are the whole
 * published surface — the repository stays inside.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      WorkSessionOrmEntity,
      SessionCheckoutOrmEntity,
      WorkSessionEventOrmEntity,
    ]),
    AuthzKernelModule.forFeature([SessionResource]),
    // The three modules this one is built on, imported rather than assumed: the
    // project a session belongs to, the machine it may run on, and what a
    // repository is called. The one edge that runs the other way — the answer to
    // "is this project still in use" — is contributed from this module's own
    // providers, so `projects/` never has to import this module.
    ProjectsModule,
    HostsModule,
    GithubModule,
    // `SESSION_DISPATCH` is bound there: the dispatcher over the runner link.
    // Importing it is what makes the port's implementation the relay's rather
    // than this module's, without this module knowing a socket exists.
    LinksModule,
    // The workspace's slug for a launch, and nothing else of organizations'.
    OrganizationsModule,
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...adapters,
    WorkSessionMapper,
    SessionPlanFactory,
    SessionLaunchSpecFactory,
    SessionNamingResolver,
    // Contributed rather than exported: the implementation is built here, in this
    // module's injector, so it injects this module's repository port while
    // `projects/` reaches across only for the registry.
    ...ProjectsModule.contributeUsage([SessionProjectUsage]),
    { provide: WORK_SESSION_REPOSITORY, useClass: WorkSessionRepository },
  ],
  // The two application ports, and nothing else. The repository is this module's
  // persistence adapter: publishing it would let the next slice read and append
  // past `RECORD_SESSION_EVENTS`, which is the door that checks the host.
  exports: [RECORD_SESSION_EVENTS, SESSION_LOOKUP, SESSION_RECONCILIATION],
})
export class SessionsModule {}
