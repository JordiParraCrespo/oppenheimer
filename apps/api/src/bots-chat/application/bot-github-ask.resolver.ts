import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotEntity } from '../../bots/domain/bot.entity';
import { FindBotsQuery } from '../../bots/queries/find-bots/find-bots.query';
import type { GithubInstallationEntity } from '../../github/domain/github-installation.entity';
import type { GithubRepository } from '../../github/infrastructure/github-app.port';
import { FindGithubLoginQuery } from '../../github/queries/find-github-login/find-github-login.query';
import { FindInstallationsQuery } from '../../github/queries/find-installations/find-installations.query';
import { ListInstallationRepositoriesQuery } from '../../github/queries/list-installation-repositories/list-installation-repositories.query';
import type { WorkspaceLookupPort } from '../../organizations/application/workspace-lookup.port';
import { WORKSPACE_LOOKUP } from '../../organizations/organizations.di-tokens';
import { BotOwnerScopeResolver } from './bot-owner-scope.resolver';

/** The workspace's owner, as an ask on GitHub is checked against them. */
export interface GithubAskOwner {
  userId: string;
  scope: AccessScope;
  /** Their GitHub login, or null when none is known here (nobody can then ask). */
  login: string | null;
}

/**
 * What an ask on GitHub reads beyond the event: who owns the workspace and
 * their GitHub login, the bots they made, and which of the workspace's
 * installations covers the repository the ask was made in. Every read is in
 * the owner's scope, as the turn it queues acts.
 */
@Injectable()
export class BotGithubAskResolver {
  constructor(
    @Inject(WORKSPACE_LOOKUP) private readonly workspaces: WorkspaceLookupPort,
    private readonly owners: BotOwnerScopeResolver,
    private readonly queryBus: QueryBus,
  ) {}

  async owner(organizationId: string): Promise<GithubAskOwner | null> {
    const userId = await this.workspaces.ownerOf(organizationId);
    const scope = await this.owners.resolve(organizationId, userId);
    if (!userId || !scope) return null;
    const login = await this.queryBus.execute<FindGithubLoginQuery, string | null>(
      new FindGithubLoginQuery({ scope }),
    );
    return { userId, scope, login };
  }

  /** The bots the owner made: only those answer them. */
  async ownBots(owner: GithubAskOwner): Promise<BotEntity[]> {
    const bots = await this.queryBus.execute<FindBotsQuery, BotEntity[]>(
      new FindBotsQuery({ scope: owner.scope }),
    );
    return bots.filter((bot) => bot.createdByUserId === owner.userId);
  }

  /** The id of the usable installation that covers the repository, or null for none. */
  async installationCovering(scope: AccessScope, githubRepoId: number): Promise<string | null> {
    const installations = await this.queryBus.execute<
      FindInstallationsQuery,
      GithubInstallationEntity[]
    >(new FindInstallationsQuery({ scope }));
    const usable = installations.filter((installation) => installation.isUsable);
    const covered = await Promise.all(
      usable.map(async (installation) => {
        const repositories = await this.queryBus.execute<
          ListInstallationRepositoriesQuery,
          GithubRepository[]
        >(new ListInstallationRepositoriesQuery({ scope, installationId: installation.id }));
        return repositories.some((repository) => repository.githubRepoId === githubRepoId);
      }),
    );
    return usable.find((_, index) => covered[index])?.id ?? null;
  }
}
