import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { sessionNamerIsConfigured } from '../config/sessions.config';
import { GithubModule } from '../github/github.module';
import { HostsModule } from '../hosts/hosts.module';
import { LinksModule } from '../links/links.module';
import { ProjectsModule } from '../projects/projects.module';
import { RecordSessionEventsResolver } from './application/record-session-events.resolver';
import { SessionLookupResolver } from './application/session-lookup.resolver';
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
import { OpenAiCompatibleSessionNamerAdapter } from './infrastructure/openai-compatible-session-namer.adapter';
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
  SESSION_LOOKUP,
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
    useFactory: (configService: ConfigService): SessionNamerPort => {
      if (!sessionNamerIsConfigured(configService)) return new NoopSessionNamerAdapter();
      const config = new SessionNamerConfig(configService);
      // `openai-compatible` is one adapter for most of the field — Groq,
      // Together, OpenRouter, vLLM, a local Ollama — which is how a session gets
      // named by a fast open-weights model without a vendor adapter each.
      return config.provider === 'openai-compatible'
        ? new OpenAiCompatibleSessionNamerAdapter(config)
        : new AnthropicSessionNamerAdapter(config);
    },
  },
  { provide: RECORD_SESSION_EVENTS, useClass: RecordSessionEventsResolver },
  { provide: SESSION_LOOKUP, useClass: SessionLookupResolver },
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
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...adapters,
    WorkSessionMapper,
    SessionPlanFactory,
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
  exports: [RECORD_SESSION_EVENTS, SESSION_LOOKUP],
})
export class SessionsModule {}
