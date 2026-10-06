import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { InboundEventsModule } from '../inbound-events/inbound-events.module';
import { GithubUserGrantResolver } from './application/github-user-grant.resolver';
import { InstallStateResolver } from './application/install-state.resolver';
import { PullRequestAccessResolver } from './application/pull-request-access.resolver';
import { RepositoryAccessResolver } from './application/repository-access.resolver';
import { ConnectInstallationCommandHandler } from './commands/connect-installation/connect-installation.command-handler';
import { ConnectInstallationHttpController } from './commands/connect-installation/connect-installation.http.controller';
import { DisconnectInstallationCommandHandler } from './commands/disconnect-installation/disconnect-installation.command-handler';
import { DisconnectInstallationHttpController } from './commands/disconnect-installation/disconnect-installation.http.controller';
import { HandleGithubWebhookCommandHandler } from './commands/handle-github-webhook/handle-github-webhook.command-handler';
import { HandleGithubWebhookHttpController } from './commands/handle-github-webhook/handle-github-webhook.http.controller';
import { StartInstallationCommandHandler } from './commands/start-installation/start-installation.command-handler';
import { StartInstallationHttpController } from './commands/start-installation/start-installation.http.controller';
import { GithubInstallationOrmEntity } from './database/github-installation.orm-entity';
import { GithubInstallationRepository } from './database/github-installation.repository';
import { GithubUserGrantOrmEntity } from './database/github-user-grant.orm-entity';
import { GithubUserGrantRepository } from './database/github-user-grant.repository';
import {
  GITHUB_APP,
  GITHUB_INSTALLATION_REPOSITORY,
  GITHUB_PULLS,
  GITHUB_USER_GRANT_REPOSITORY,
  PULL_REQUEST_ACCESS,
  REPOSITORY_ACCESS,
  USER_TOKEN_SEALER,
} from './github.di-tokens';
import { InstallationResource } from './github.resource';
import { GithubInstallationMapper } from './github-installation.mapper';
import { AesUserTokenSealerAdapter } from './infrastructure/aes-user-token-sealer.adapter';
import { GithubEventSource } from './infrastructure/github-event-source.adapter';
import { GithubPullsAdapter } from './infrastructure/github-pulls.adapter';
import { GithubRateLimit } from './infrastructure/github-rate-limit.adapter';
import { GithubRestAdapter } from './infrastructure/github-rest.adapter';
import { FindInstallationQueryHandler } from './queries/find-installation/find-installation.query-handler';
import { FindInstallationsHttpController } from './queries/find-installations/find-installations.http.controller';
import { FindInstallationsQueryHandler } from './queries/find-installations/find-installations.query-handler';
import { ListInstallationRepositoriesHttpController } from './queries/list-installation-repositories/list-installation-repositories.http.controller';
import { ListInstallationRepositoriesQueryHandler } from './queries/list-installation-repositories/list-installation-repositories.query-handler';
import { ListRepositoryBranchesHttpController } from './queries/list-repository-branches/list-repository-branches.http.controller';
import { ListRepositoryBranchesQueryHandler } from './queries/list-repository-branches/list-repository-branches.query-handler';

// Static routes before parameterized ones.
const httpControllers = [
  FindInstallationsHttpController,
  StartInstallationHttpController,
  ConnectInstallationHttpController,
  HandleGithubWebhookHttpController,
  ListInstallationRepositoriesHttpController,
  ListRepositoryBranchesHttpController,
  DisconnectInstallationHttpController,
];

const commandHandlers: Provider[] = [
  ConnectInstallationCommandHandler,
  DisconnectInstallationCommandHandler,
  HandleGithubWebhookCommandHandler,
  StartInstallationCommandHandler,
];

const queryHandlers: Provider[] = [
  FindInstallationQueryHandler,
  FindInstallationsQueryHandler,
  ListInstallationRepositoriesQueryHandler,
  ListRepositoryBranchesQueryHandler,
];

const mappers: Provider[] = [GithubInstallationMapper];

const adapters: Provider[] = [
  { provide: GITHUB_INSTALLATION_REPOSITORY, useClass: GithubInstallationRepository },
  { provide: GITHUB_APP, useClass: GithubRestAdapter },
  { provide: REPOSITORY_ACCESS, useClass: RepositoryAccessResolver },
  { provide: GITHUB_USER_GRANT_REPOSITORY, useClass: GithubUserGrantRepository },
  { provide: USER_TOKEN_SEALER, useClass: AesUserTokenSealerAdapter },
  { provide: GITHUB_PULLS, useClass: GithubPullsAdapter },
  { provide: PULL_REQUEST_ACCESS, useClass: PullRequestAccessResolver },
  // One instance behind both adapters, so they share one in-flight cap and one pause per bucket.
  GithubRateLimit,
  InstallStateResolver,
  GithubUserGrantResolver,
];

/**
 * What GitHub grants this workspace, and how the platform exercises it.
 *
 * One table and one aggregate, because there is only one thing worth persisting:
 * which installations a workspace claimed. Repositories and branches are read
 * live through the installation token and tokens are minted on demand, so the
 * two facts that would otherwise drift — what access exists, and what it covers —
 * both have their owner on GitHub's side
 * (`product/versions/mvp/03-control-plane.md`).
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([GithubInstallationOrmEntity, GithubUserGrantOrmEntity]),
    AuthzKernelModule.forFeature([InstallationResource]),
    // The hub its non-installation deliveries go to, and the registry this
    // module contributes its event source to.
    InboundEventsModule,
  ],
  controllers: [...httpControllers],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...mappers,
    ...adapters,
    ...InboundEventsModule.contributeSources([GithubEventSource]),
  ],
  // `REPOSITORY_ACCESS` and `PULL_REQUEST_ACCESS`, and nothing else. The GitHub
  // client and the unscoped installation lookup are this module's own: exporting
  // them is how `sessions/` and `relay/` would end up minting with GitHub's
  // numeric id, past the port that translates a checkout's uuid and checks the
  // installation is usable — and how a user token would leave this module.
  exports: [REPOSITORY_ACCESS, PULL_REQUEST_ACCESS],
})
export class GithubModule {}
