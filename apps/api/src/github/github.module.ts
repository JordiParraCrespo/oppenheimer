import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthzModule as AuthzKernelModule } from '@oppenheimer/backend-authz';
import { configKeySealer } from '@oppenheimer/backend-core';
import { githubUserTokenKeyOf } from '../config/github.config';
import { InboundEventsModule } from '../inbound-events/inbound-events.module';
import { GithubAccessResolver } from './application/github-access.resolver';
import { GithubTokenResolver } from './application/github-token.resolver';
import { GithubUserGrantResolver } from './application/github-user-grant.resolver';
import { InstallStateResolver } from './application/install-state.resolver';
import { IssueAccessResolver } from './application/issue-access.resolver';
import { PullRequestDirectoryResolver } from './application/pull-request-directory.resolver';
import { PullRequestListingResolver } from './application/pull-request-listing.resolver';
import { PullRequestReadResolver } from './application/pull-request-read.resolver';
import { PullRequestSnapshotResolver } from './application/pull-request-snapshot.resolver';
import { PullRequestSourceResolver } from './application/pull-request-source.resolver';
import { PullRequestWriteResolver } from './application/pull-request-write.resolver';
import { RepositoryAccessResolver } from './application/repository-access.resolver';
import { AddGithubTokenCommandHandler } from './commands/add-github-token/add-github-token.command-handler';
import { AddGithubTokenHttpController } from './commands/add-github-token/add-github-token.http.controller';
import { AddIssueCommentCommandHandler } from './commands/add-issue-comment/add-issue-comment.command-handler';
import { CheckGithubTokenCommandHandler } from './commands/check-github-token/check-github-token.command-handler';
import { CheckGithubTokenHttpController } from './commands/check-github-token/check-github-token.http.controller';
import { ConnectInstallationCommandHandler } from './commands/connect-installation/connect-installation.command-handler';
import { ConnectInstallationHttpController } from './commands/connect-installation/connect-installation.http.controller';
import { CreateIssueCommandHandler } from './commands/create-issue/create-issue.command-handler';
import { DisconnectInstallationCommandHandler } from './commands/disconnect-installation/disconnect-installation.command-handler';
import { DisconnectInstallationHttpController } from './commands/disconnect-installation/disconnect-installation.http.controller';
import { HandleGithubWebhookCommandHandler } from './commands/handle-github-webhook/handle-github-webhook.command-handler';
import { HandleGithubWebhookHttpController } from './commands/handle-github-webhook/handle-github-webhook.http.controller';
import { PinGithubTokenCommandHandler } from './commands/pin-github-token/pin-github-token.command-handler';
import { PinGithubTokenHttpController } from './commands/pin-github-token/pin-github-token.http.controller';
import { RemoveGithubTokenCommandHandler } from './commands/remove-github-token/remove-github-token.command-handler';
import { RemoveGithubTokenHttpController } from './commands/remove-github-token/remove-github-token.http.controller';
import { RenameGithubTokenCommandHandler } from './commands/rename-github-token/rename-github-token.command-handler';
import { RenameGithubTokenHttpController } from './commands/rename-github-token/rename-github-token.http.controller';
import { StartInstallationCommandHandler } from './commands/start-installation/start-installation.command-handler';
import { StartInstallationHttpController } from './commands/start-installation/start-installation.http.controller';
import { UnpinGithubTokenCommandHandler } from './commands/unpin-github-token/unpin-github-token.command-handler';
import { UnpinGithubTokenHttpController } from './commands/unpin-github-token/unpin-github-token.http.controller';
import { GithubInstallationOrmEntity } from './database/github-installation.orm-entity';
import { GithubInstallationRepository } from './database/github-installation.repository';
import { GithubTokenOrmEntity } from './database/github-token.orm-entity';
import { GithubTokenRepository } from './database/github-token.repository';
import { GithubTokenPinOrmEntity } from './database/github-token-pin.orm-entity';
import { GithubUserGrantOrmEntity } from './database/github-user-grant.orm-entity';
import { GithubUserGrantRepository } from './database/github-user-grant.repository';
import {
  GITHUB_APP,
  GITHUB_INSTALLATION_REPOSITORY,
  GITHUB_ISSUES,
  GITHUB_PULLS,
  GITHUB_TOKEN_REPOSITORY,
  GITHUB_TOKENS,
  GITHUB_USER_GRANT_REPOSITORY,
  ISSUE_ACCESS,
  PULL_REQUEST_DIRECTORY,
  PULL_REQUEST_LISTINGS,
  PULL_REQUEST_READS,
  PULL_REQUEST_WRITES,
  REPOSITORY_ACCESS,
  USER_TOKEN_SEALER,
} from './github.di-tokens';
import { InstallationResource } from './github.resource';
import { GithubInstallationMapper } from './github-installation.mapper';
import { GithubTokenMapper } from './github-token.mapper';

import { GithubEventSource } from './infrastructure/github-event-source.adapter';
import { GithubHttp } from './infrastructure/github-http.adapter';
import { GithubIssuesAdapter } from './infrastructure/github-issues.adapter';
import { GithubPullsAdapter } from './infrastructure/github-pulls.adapter';
import { GithubRestAdapter } from './infrastructure/github-rest.adapter';
import { GithubTokensAdapter } from './infrastructure/github-tokens.adapter';
import { FindGithubTokenReadsHttpController } from './queries/find-github-token-reads/find-github-token-reads.http.controller';
import { FindGithubTokenReadsQueryHandler } from './queries/find-github-token-reads/find-github-token-reads.query-handler';
import { FindGithubTokensHttpController } from './queries/find-github-tokens/find-github-tokens.http.controller';
import { FindGithubTokensQueryHandler } from './queries/find-github-tokens/find-github-tokens.query-handler';
import { FindInstallationQueryHandler } from './queries/find-installation/find-installation.query-handler';
import { FindInstallationsHttpController } from './queries/find-installations/find-installations.http.controller';
import { FindInstallationsQueryHandler } from './queries/find-installations/find-installations.query-handler';
import { FindIssueQueryHandler } from './queries/find-issue/find-issue.query-handler';
import { FindIssueCommentsQueryHandler } from './queries/find-issue-comments/find-issue-comments.query-handler';
import { FindIssuesQueryHandler } from './queries/find-issues/find-issues.query-handler';
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
  // `github/tokens`: the static `repositories` and `pins/…` before `:id`.
  FindGithubTokensHttpController,
  FindGithubTokenReadsHttpController,
  AddGithubTokenHttpController,
  PinGithubTokenHttpController,
  UnpinGithubTokenHttpController,
  CheckGithubTokenHttpController,
  RenameGithubTokenHttpController,
  RemoveGithubTokenHttpController,
];

const commandHandlers: Provider[] = [
  AddGithubTokenCommandHandler,
  AddIssueCommentCommandHandler,
  CheckGithubTokenCommandHandler,
  PinGithubTokenCommandHandler,
  RemoveGithubTokenCommandHandler,
  RenameGithubTokenCommandHandler,
  UnpinGithubTokenCommandHandler,
  ConnectInstallationCommandHandler,
  CreateIssueCommandHandler,
  DisconnectInstallationCommandHandler,
  HandleGithubWebhookCommandHandler,
  StartInstallationCommandHandler,
];

const queryHandlers: Provider[] = [
  FindGithubTokenReadsQueryHandler,
  FindGithubTokensQueryHandler,
  FindInstallationQueryHandler,
  FindInstallationsQueryHandler,
  FindIssueQueryHandler,
  FindIssueCommentsQueryHandler,
  FindIssuesQueryHandler,
  ListInstallationRepositoriesQueryHandler,
  ListRepositoryBranchesQueryHandler,
];

const mappers: Provider[] = [GithubInstallationMapper, GithubTokenMapper];

const adapters: Provider[] = [
  { provide: GITHUB_INSTALLATION_REPOSITORY, useClass: GithubInstallationRepository },
  { provide: GITHUB_APP, useClass: GithubRestAdapter },
  { provide: REPOSITORY_ACCESS, useClass: RepositoryAccessResolver },
  { provide: GITHUB_USER_GRANT_REPOSITORY, useClass: GithubUserGrantRepository },
  configKeySealer(USER_TOKEN_SEALER, {
    configKey: 'githubApp.userTokenKey',
    envName: 'GITHUB_USER_TOKEN_KEY',
    keyOf: githubUserTokenKeyOf,
  }),
  { provide: GITHUB_PULLS, useClass: GithubPullsAdapter },
  { provide: PULL_REQUEST_DIRECTORY, useClass: PullRequestDirectoryResolver },
  { provide: PULL_REQUEST_LISTINGS, useClass: PullRequestListingResolver },
  { provide: PULL_REQUEST_READS, useClass: PullRequestReadResolver },
  { provide: PULL_REQUEST_WRITES, useClass: PullRequestWriteResolver },
  { provide: GITHUB_ISSUES, useClass: GithubIssuesAdapter },
  { provide: ISSUE_ACCESS, useClass: IssueAccessResolver },
  { provide: GITHUB_TOKEN_REPOSITORY, useClass: GithubTokenRepository },
  { provide: GITHUB_TOKENS, useClass: GithubTokensAdapter },
  // The installation tokens and the caller's own token, shared by both accesses.
  GithubAccessResolver,
  // The one client both GitHub adapters send through: one in-flight cap, one pause per bucket.
  GithubHttp,
  InstallStateResolver,
  GithubUserGrantResolver,
  GithubTokenResolver,
  // One fill per snapshot key, whether the queue, the figures or one pull request's screen asks.
  PullRequestSnapshotResolver,
  // Which pull requests a repository has, before the listings fill any.
  PullRequestSourceResolver,
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
    TypeOrmModule.forFeature([
      GithubInstallationOrmEntity,
      GithubUserGrantOrmEntity,
      GithubTokenOrmEntity,
      GithubTokenPinOrmEntity,
    ]),
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
  // `REPOSITORY_ACCESS`, the four `PULL_REQUEST_*` doors and `ISSUE_ACCESS`, and nothing else. The GitHub
  // client and the unscoped installation lookup are this module's own: exporting
  // them is how `sessions/` and `relay/` would end up minting with GitHub's
  // numeric id, past the port that translates a checkout's uuid and checks the
  // installation is usable — and how a user token would leave this module.
  exports: [
    REPOSITORY_ACCESS,
    PULL_REQUEST_DIRECTORY,
    PULL_REQUEST_LISTINGS,
    PULL_REQUEST_READS,
    PULL_REQUEST_WRITES,
    ISSUE_ACCESS,
  ],
})
export class GithubModule {}
