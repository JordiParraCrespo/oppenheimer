import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { GithubInstallationEntity } from '../../github/domain/github-installation.entity';
import { FindInstallationsQuery } from '../../github/queries/find-installations/find-installations.query';
import { ListInstallationRepositoriesQuery } from '../../github/queries/list-installation-repositories/list-installation-repositories.query';
import { FindPullRequestQuery } from '../../pull-requests/queries/find-pull-request/find-pull-request.query';
import type { PullRequestDetailView, RepositoryView } from '../bot-github-tool.mapper';
import { BotSubscriptionMapper } from '../bot-subscription.mapper';
import { BOT_SUBSCRIPTION_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotSubscriptionRepositoryPort } from '../database/bot-subscription.repository.port';
import { BotSubscriptionEntity } from '../domain/bot-subscription.entity';
import { BOT_SUBSCRIPTIONS_PER_BOT } from '../domain/bot-subscription.policy';
import { type BotToolCallContext, BotToolRefusal } from './bot-tool.factory';

/** A repository as the bot names it: GitHub's id, or `owner/name`. */
export type RepositoryHandle = number | string;

/** What a pull request watch came to: the subscription as stored, and the pull request as read. */
export interface PullRequestWatch {
  subscription: BotSubscriptionEntity;
  pull: PullRequestDetailView;
}

/**
 * A bot starts or stops following a pull request (`27-bot-subscriptions.md`
 * §7). The repository must be one the owner can read: it is looked for among
 * the repositories the workspace's usable installations cover, read as the
 * owner, as `list_repositories` reads them, and the pull request is then read
 * as the owner too, so a number that is an issue, or a pull request already
 * merged or closed, is refused before anything is stored.
 */
@Injectable()
export class BotPullRequestWatchResolver {
  constructor(
    @Inject(BOT_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: BotSubscriptionRepositoryPort,
    private readonly queries: QueryBus,
    private readonly mapper: BotSubscriptionMapper,
  ) {}

  async watch(
    context: BotToolCallContext,
    repository: RepositoryHandle,
    number: number,
    purpose: string | null,
  ): Promise<PullRequestWatch> {
    const found = await this.findRepository(context.owner, repository);
    const pull = await this.queries.execute<FindPullRequestQuery, PullRequestDetailView>(
      new FindPullRequestQuery({
        scope: context.owner,
        address: {
          kind: 'installation',
          installationId: found.installationId,
          githubRepoId: found.repository.githubRepoId,
          number,
        },
      }),
    );
    if (pull.state !== 'open') {
      throw new BotToolRefusal(
        `Pull request #${number} of ${found.repository.fullName} is ${pull.state}: there is nothing left to follow.`,
      );
    }
    const ref = {
      githubRepoId: String(found.repository.githubRepoId),
      repository: found.repository.fullName,
      number,
    };
    await this.assertRoom(context, ref);
    const subscription = await this.subscriptions.subscribe(
      BotSubscriptionEntity.subscribeToPullRequest(
        this.mapper.toPullRequestSubscribeProps(context, ref, purpose),
      ),
    );
    return { subscription, pull };
  }

  /** The bot stops following it; the repository is named as it watched it, by id or by name. */
  async unwatch(
    context: BotToolCallContext,
    repository: RepositoryHandle,
    number: number,
  ): Promise<boolean> {
    const followed = (
      await this.subscriptions.findForBot(
        context.organizationId,
        context.botId,
        BOT_SUBSCRIPTIONS_PER_BOT,
      )
    ).find(
      (subscription) =>
        subscription.pullRequest?.number === number &&
        namesRepository(subscription.pullRequest, repository),
    )?.pullRequest;
    if (!followed) return false;
    return this.subscriptions.unsubscribePullRequest(
      context.organizationId,
      context.botId,
      followed,
    );
  }

  /** The limit is one for sessions and pull requests together; watching one again is not a new one. */
  private async assertRoom(
    context: BotToolCallContext,
    ref: { githubRepoId: string; number: number },
  ): Promise<void> {
    const existing = await this.subscriptions.findForBot(
      context.organizationId,
      context.botId,
      BOT_SUBSCRIPTIONS_PER_BOT,
    );
    const already = existing.some(
      (subscription) =>
        subscription.pullRequest?.githubRepoId === ref.githubRepoId &&
        subscription.pullRequest.number === ref.number,
    );
    if (!already && existing.length >= BOT_SUBSCRIPTIONS_PER_BOT) {
      throw new BotToolRefusal(
        `You already follow ${BOT_SUBSCRIPTIONS_PER_BOT} sessions and pull requests. Unwatch one you no longer need (list_watches shows them) first.`,
      );
    }
  }

  /**
   * The repository among those the owner's usable installations cover. One
   * installation GitHub could not list is skipped, and said only if no other
   * covers the repository.
   */
  private async findRepository(
    owner: AccessScope,
    handle: RepositoryHandle,
  ): Promise<{ installationId: string; repository: RepositoryView }> {
    const installations = await this.queries.execute<
      FindInstallationsQuery,
      GithubInstallationEntity[]
    >(new FindInstallationsQuery({ scope: owner }));
    const usable = installations.filter((installation) => installation.isUsable);
    if (usable.length === 0) {
      throw new BotToolRefusal(
        'GitHub is not connected to this workspace, or its installations are suspended: there is no pull request you can follow.',
      );
    }
    let unlisted = 0;
    for (const installation of usable) {
      let repositories: RepositoryView[];
      try {
        repositories = await this.queries.execute<
          ListInstallationRepositoriesQuery,
          RepositoryView[]
        >(new ListInstallationRepositoriesQuery({ scope: owner, installationId: installation.id }));
      } catch {
        unlisted += 1;
        continue;
      }
      const repository = repositories.find((candidate) => matches(candidate, handle));
      if (repository) return { installationId: installation.id, repository };
    }
    const why = unlisted
      ? ` (${unlisted} installation${unlisted === 1 ? '' : 's'} could not be listed just now; try again later)`
      : '';
    throw new BotToolRefusal(
      `Repository ${handle} is not one the workspace's GitHub installations let its owner read${why}. list_repositories shows the ones you can follow.`,
    );
  }
}

function matches(repository: RepositoryView, handle: RepositoryHandle): boolean {
  return typeof handle === 'number'
    ? repository.githubRepoId === handle
    : repository.fullName.toLowerCase() === handle.toLowerCase();
}

function namesRepository(
  pull: { githubRepoId: string; repository: string },
  handle: RepositoryHandle,
): boolean {
  return typeof handle === 'number'
    ? pull.githubRepoId === String(handle)
    : pull.repository.toLowerCase() === handle.toLowerCase();
}
