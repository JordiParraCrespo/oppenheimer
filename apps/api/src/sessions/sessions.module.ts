import { Inject, Module, type OnModuleInit, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { sessionNamerIsConfigured } from '../config/sessions.config';
import { GithubModule } from '../github/github.module';
import { HostsModule } from '../hosts/hosts.module';
import type { ProjectUsageRegistrarPort } from '../projects/application/project-usage.port';
import { PROJECT_USAGE_REGISTRAR } from '../projects/projects.di-tokens';
import { ProjectsModule } from '../projects/projects.module';
import { RecordSessionEventsResolver } from './application/record-session-events.resolver';
import { SessionNamingResolver } from './application/session-naming.resolver';
import { SessionPlanFactory } from './application/session-plan.factory';
import { SessionProjectUsage } from './application/session-project-usage.resolver';
import { AddCheckoutCommandHandler } from './commands/add-checkout/add-checkout.command-handler';
import { AddCheckoutHttpController } from './commands/add-checkout/add-checkout.http.controller';
import { CloseSessionCommandHandler } from './commands/close-session/close-session.command-handler';
import { CloseSessionHttpController } from './commands/close-session/close-session.http.controller';
import { CreateSessionCommandHandler } from './commands/create-session/create-session.command-handler';
import { CreateSessionHttpController } from './commands/create-session/create-session.http.controller';
import { IssueAttachTicketCommandHandler } from './commands/issue-attach-ticket/issue-attach-ticket.command-handler';
import { IssueAttachTicketHttpController } from './commands/issue-attach-ticket/issue-attach-ticket.http.controller';
import { RecordSessionEventsCommandHandler } from './commands/record-session-events/record-session-events.command-handler';
import { RemoveCheckoutCommandHandler } from './commands/remove-checkout/remove-checkout.command-handler';
import { RemoveCheckoutHttpController } from './commands/remove-checkout/remove-checkout.http.controller';
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
import { AnthropicSessionNamerAdapter } from './infrastructure/anthropic-session-namer.adapter';
import { NoopSessionNamerAdapter } from './infrastructure/noop-session-namer.adapter';
import { PendingSessionDispatchAdapter } from './infrastructure/pending-session-dispatch.adapter';
import { SessionNamerConfig } from './infrastructure/session-namer.config';
import type { SessionNamerPort } from './infrastructure/session-namer.port';
import { FindSessionHttpController } from './queries/find-session/find-session.http.controller';
import { FindSessionQueryHandler } from './queries/find-session/find-session.query-handler';
import { FindSessionEventsHttpController } from './queries/find-session-events/find-session-events.http.controller';
import { FindSessionEventsQueryHandler } from './queries/find-session-events/find-session-events.query-handler';
import { FindSessionsHttpController } from './queries/find-sessions/find-sessions.http.controller';
import { FindSessionsQueryHandler } from './queries/find-sessions/find-sessions.query-handler';
import {
  RECORD_SESSION_EVENTS,
  SESSION_DISPATCH,
  SESSION_NAMER,
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
  StopSessionHttpController,
  RestartSessionHttpController,
  AddCheckoutHttpController,
  RemoveCheckoutHttpController,
  FindSessionHttpController,
  RenameSessionHttpController,
  CloseSessionHttpController,
];

const commandHandlers: Provider[] = [
  CreateSessionCommandHandler,
  RenameSessionCommandHandler,
  StopSessionCommandHandler,
  RestartSessionCommandHandler,
  CloseSessionCommandHandler,
  AddCheckoutCommandHandler,
  RemoveCheckoutCommandHandler,
  IssueAttachTicketCommandHandler,
  RecordSessionEventsCommandHandler,
];

const queryHandlers: Provider[] = [
  FindSessionsQueryHandler,
  FindSessionQueryHandler,
  FindSessionEventsQueryHandler,
];

const adapters: Provider[] = [
  SessionNamerConfig,
  {
    // The abstract-class-plus-factory shape `packages/backend/email` already
    // follows: the provider is an environment variable, and a provider whose key
    // or model is missing is *not configured* rather than half-configured — the
    // no-op adapter is then the honest binding, and every session keeps its slug.
    provide: SESSION_NAMER,
    inject: [ConfigService],
    useFactory: (configService: ConfigService): SessionNamerPort =>
      sessionNamerIsConfigured(configService)
        ? new AnthropicSessionNamerAdapter(new SessionNamerConfig(configService))
        : new NoopSessionNamerAdapter(),
  },
  // Bound to the adapter that records the job as owed until there is a link to
  // send it over. It is a real implementation of the port, not a stub: "this work
  // never reached a host" is a durable entry in the session's log.
  { provide: SESSION_DISPATCH, useClass: PendingSessionDispatchAdapter },
  { provide: RECORD_SESSION_EVENTS, useClass: RecordSessionEventsResolver },
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
    // "is this project still in use" — is registered in `onModuleInit` below, so
    // `projects/` never has to import this module.
    ProjectsModule,
    HostsModule,
    GithubModule,
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...adapters,
    WorkSessionMapper,
    SessionPlanFactory,
    SessionNamingResolver,
    SessionProjectUsage,
    { provide: WORK_SESSION_REPOSITORY, useClass: WorkSessionRepository },
  ],
  // The two application ports, and nothing else. The repository is this module's
  // persistence adapter: publishing it would let the next slice read and append
  // past `RECORD_SESSION_EVENTS`, which is the door that checks the host.
  exports: [SESSION_DISPATCH, RECORD_SESSION_EVENTS],
})
export class SessionsModule implements OnModuleInit {
  constructor(
    @Inject(PROJECT_USAGE_REGISTRAR)
    private readonly projectUsage: ProjectUsageRegistrarPort,
    private readonly sessionUsage: SessionProjectUsage,
  ) {}

  /**
   * Hand `projects/` the one question it cannot answer for itself.
   *
   * The dependency only runs one way — a session needs the project it belongs to,
   * so `projects/` cannot import this module to inject a port from it — and this is
   * the way back: the implementation is provided here, where its own dependencies
   * are, and registered on boot. A deployment built without this module registers
   * nothing and archiving refuses, which is fail-closed by construction rather than
   * by a caught exception.
   *
   * It is a lifecycle hook rather than a `forFeature`-style factory provider on
   * `ProjectsModule` because the implementation needs *this* module's injector: a
   * provider declared inside a dynamic module of `ProjectsModule` cannot resolve
   * `WORK_SESSION_REPOSITORY`. What crosses the seam is a port and a token, never
   * a class from the other module's insides.
   */
  onModuleInit(): void {
    this.projectUsage.register(this.sessionUsage);
  }
}
