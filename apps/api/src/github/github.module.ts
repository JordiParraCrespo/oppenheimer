import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { RepositoryAccessResolver } from './application/repository-access.resolver';
import { ConnectInstallationCommandHandler } from './commands/connect-installation/connect-installation.command-handler';
import { ConnectInstallationHttpController } from './commands/connect-installation/connect-installation.http.controller';
import { DisconnectInstallationCommandHandler } from './commands/disconnect-installation/disconnect-installation.command-handler';
import { DisconnectInstallationHttpController } from './commands/disconnect-installation/disconnect-installation.http.controller';
import { HandleGithubWebhookCommandHandler } from './commands/handle-github-webhook/handle-github-webhook.command-handler';
import { HandleGithubWebhookHttpController } from './commands/handle-github-webhook/handle-github-webhook.http.controller';
import { GithubInstallationOrmEntity } from './database/github-installation.orm-entity';
import { GithubInstallationRepository } from './database/github-installation.repository';
import { GITHUB_APP, GITHUB_INSTALLATION_REPOSITORY, REPOSITORY_ACCESS } from './github.di-tokens';
import { InstallationResource } from './github.resource';
import { GithubInstallationMapper } from './github-installation.mapper';
import { OctokitGithubAppAdapter } from './infrastructure/octokit-github-app.adapter';
import { FindInstallationQueryHandler } from './queries/find-installation/find-installation.query-handler';
import { FindInstallationsHttpController } from './queries/find-installations/find-installations.http.controller';
import { FindInstallationsQueryHandler } from './queries/find-installations/find-installations.query-handler';
import { ListInstallationRepositoriesHttpController } from './queries/list-installation-repositories/list-installation-repositories.http.controller';
import { ListInstallationRepositoriesQueryHandler } from './queries/list-installation-repositories/list-installation-repositories.query-handler';
import { ListRepositoryBranchesHttpController } from './queries/list-repository-branches/list-repository-branches.http.controller';
import { ListRepositoryBranchesQueryHandler } from './queries/list-repository-branches/list-repository-branches.query-handler';

// Static routes before parameterized ones, so `POST /installations` is not
// shadowed and `:id/repositories` is registered before `:id/...` variants.
const httpControllers = [
  FindInstallationsHttpController,
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
  { provide: GITHUB_APP, useClass: OctokitGithubAppAdapter },
  { provide: REPOSITORY_ACCESS, useClass: RepositoryAccessResolver },
];

/**
 * What GitHub grants this workspace, and how the platform exercises it.
 *
 * One table and one aggregate, because there is only one thing worth persisting:
 * which installations a workspace claimed. Repositories and branches are read
 * live through the installation token and tokens are minted on demand, so the
 * two facts that would otherwise drift — what access exists, and what it covers —
 * both have their owner on GitHub's side (`product/09-github-app-install.md`).
 *
 * `REPOSITORY_ACCESS` is exported because that is the seam `sessions/` and
 * `relay/` use: they name an installation and a repository, and get a credential
 * for exactly that repository.
 */
@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([GithubInstallationOrmEntity]),
    AuthzKernelModule.forFeature([InstallationResource]),
  ],
  controllers: [...httpControllers],
  providers: [...commandHandlers, ...queryHandlers, ...mappers, ...adapters],
  exports: [GITHUB_INSTALLATION_REPOSITORY, REPOSITORY_ACCESS, GITHUB_APP],
})
export class GithubModule {}
