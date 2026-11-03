/**
 * The tools a bot follows pull requests with (`27-bot-subscriptions.md` §7):
 * a watch is stored only for a repository the owner's usable installations
 * let them read, read as the owner, for an open pull request, with the turn,
 * scopes and zone that asked; the per-bot limit is shared with sessions; and
 * unwatch touches only the bot's own subscription. The upsert and its unique
 * index are the integration suite's.
 */
import type { QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import type { GithubInstallationEntity } from '../../../github/domain/github-installation.entity';
import { FindInstallationsQuery } from '../../../github/queries/find-installations/find-installations.query';
import { ListInstallationRepositoriesQuery } from '../../../github/queries/list-installation-repositories/list-installation-repositories.query';
import { FindPullRequestQuery } from '../../../pull-requests/queries/find-pull-request/find-pull-request.query';
import { BotSubscriptionMapper } from '../../bot-subscription.mapper';
import type { BotSubscriptionRepositoryPort } from '../../database/bot-subscription.repository.port';
import { BotSubscriptionEntity } from '../../domain/bot-subscription.entity';
import { BOT_SUBSCRIPTIONS_PER_BOT } from '../../domain/bot-subscription.policy';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import { BotPullRequestWatchResolver } from '../bot-pull-request-watch.resolver';
import { BotPullRequestWatchToolsFactory } from '../bot-pull-request-watch-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

const owner = emptyScope('owner-1', 'org-1');
const INSTALLATION = '11111111-1111-4111-8111-111111111111';
const REPO = { githubRepoId: 821374923, fullName: 'acme-labs/app' };

function setup(
  options: {
    repositories?: { githubRepoId: number; fullName: string }[];
    usable?: boolean;
    state?: 'open' | 'merged' | 'closed';
    following?: BotSubscriptionEntity[];
  } = {},
) {
  const subscriptions = {
    subscribe: vi.fn<BotSubscriptionRepositoryPort['subscribe']>(
      async (subscription) => subscription,
    ),
    findForBot: vi.fn<BotSubscriptionRepositoryPort['findForBot']>(
      async () => options.following ?? [],
    ),
    unsubscribePullRequest: vi.fn<BotSubscriptionRepositoryPort['unsubscribePullRequest']>(
      async () => true,
    ),
  };
  const queries = {
    execute: vi.fn(async (query: unknown) => {
      if (query instanceof FindInstallationsQuery) {
        return [{ id: INSTALLATION, isUsable: options.usable ?? true } as GithubInstallationEntity];
      }
      if (query instanceof ListInstallationRepositoriesQuery) return options.repositories ?? [REPO];
      if (query instanceof FindPullRequestQuery) {
        return { number: 128, installationId: INSTALLATION, state: options.state ?? 'open' };
      }
      throw new Error('unexpected query');
    }),
  };
  const factory = new BotPullRequestWatchToolsFactory(
    new BotPullRequestWatchResolver(
      subscriptions as unknown as BotSubscriptionRepositoryPort,
      queries as unknown as QueryBus,
      new BotSubscriptionMapper(),
    ),
  );
  const context: BotToolContext = {
    owner,
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    homeHostId: null,
    timeZone: 'Europe/Madrid',
    permission: 'auto',
    permissions: NO_PERMISSIONS,
    approvals: { request: vi.fn<BotApprovalRequesterPort['request']>() },
    budget: new BotTurnBudget(),
    credentialScopes: ['pulls:read'],
  };
  const call = (name: string, input: unknown) => {
    const definition = factory.definitions().find((candidate) => candidate.name === name);
    if (!definition) throw new Error(`no tool ${name}`);
    return definition.bind(context).run(input, { signal: new AbortController().signal });
  };
  return { subscriptions, queries, call, context };
}

function followed(number: number, githubRepoId = '821374923') {
  return BotSubscriptionEntity.subscribeToPullRequest({
    organizationId: 'org-1',
    botId: 'bot-1',
    pullRequest: { githubRepoId, repository: 'acme-labs/app', number },
    originTurnId: 'turn-0',
    purpose: null,
    credentialScopes: null,
    timeZone: null,
  });
}

describe('BotPullRequestWatchToolsFactory', () => {
  it('follows an open pull request of a repository the owner can read, named by owner/name, for the turn that asked', async () => {
    const { subscriptions, queries, call } = setup();
    const result = await call('watch_pull_request', {
      repository: 'Acme-Labs/App',
      number: 128,
      purpose: 'land the login fix',
    });
    // Every read is the owner's: the installations, their repositories and the pull request.
    for (const [query] of queries.execute.mock.calls) {
      expect(query).toMatchObject({ scope: owner });
    }
    expect(queries.execute.mock.calls[2][0]).toMatchObject({
      address: { installationId: INSTALLATION, githubRepoId: REPO.githubRepoId, number: 128 },
    });
    expect(subscriptions.subscribe.mock.calls[0][0]).toMatchObject({
      resourceKind: 'pull_request',
      resourceId: null,
      pullRequest: { githubRepoId: '821374923', repository: 'acme-labs/app', number: 128 },
      originTurnId: 'turn-1',
      purpose: 'land the login fix',
      credentialScopes: ['pulls:read'],
      timeZone: 'Europe/Madrid',
    });
    expect(result.isError).not.toBe(true);
    expect(result.content).toContain('You follow pull request #128 of acme-labs/app');
  });

  it('takes the repository by its id too', async () => {
    const { subscriptions, call } = setup();
    await call('watch_pull_request', { repository: REPO.githubRepoId, number: 128 });
    expect(subscriptions.subscribe).toHaveBeenCalledOnce();
  });

  // Regression: a bot following a repository its owner cannot read would hear
  // about work in it, metadata or not.
  it('refuses a repository no usable installation lets the owner read, and stores nothing', async () => {
    const { subscriptions, call } = setup({
      repositories: [{ githubRepoId: 1, fullName: 'acme-labs/other' }],
    });
    const result = await call('watch_pull_request', { repository: 'acme-labs/app', number: 128 });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('list_repositories');
    expect(subscriptions.subscribe).not.toHaveBeenCalled();

    const suspended = setup({ usable: false });
    expect(
      (await suspended.call('watch_pull_request', { repository: 'acme-labs/app', number: 128 }))
        .isError,
    ).toBe(true);
    expect(suspended.subscriptions.subscribe).not.toHaveBeenCalled();
  });

  it('refuses a pull request that is already merged or closed', async () => {
    const { subscriptions, call } = setup({ state: 'merged' });
    const result = await call('watch_pull_request', { repository: 'acme-labs/app', number: 128 });
    expect(result.isError).toBe(true);
    expect(subscriptions.subscribe).not.toHaveBeenCalled();
  });

  it('shares the per-bot limit with sessions, but lets a followed pull request be watched again', async () => {
    const full = Array.from({ length: BOT_SUBSCRIPTIONS_PER_BOT }, (_, i) => followed(i + 1));
    const refused = setup({ following: full.map((s, i) => (i === 0 ? followed(999, '7') : s)) });
    const result = await refused.call('watch_pull_request', {
      repository: 'acme-labs/app',
      number: 128,
    });
    expect(result.isError).toBe(true);
    expect(refused.subscriptions.subscribe).not.toHaveBeenCalled();

    const again = setup({ following: [...full.slice(1), followed(128)] });
    await again.call('watch_pull_request', { repository: 'acme-labs/app', number: 128 });
    expect(again.subscriptions.subscribe).toHaveBeenCalledOnce();
  });

  it('unwatches only a pull request the bot follows, named as it watched it', async () => {
    const { subscriptions, call } = setup({ following: [followed(128)] });
    expect(
      (await call('unwatch_pull_request', { repository: 821374923, number: 128 })).content,
    ).toBe('You no longer follow pull request #128 of 821374923.');
    expect(subscriptions.unsubscribePullRequest).toHaveBeenCalledWith('org-1', 'bot-1', {
      githubRepoId: '821374923',
      repository: 'acme-labs/app',
      number: 128,
    });
    subscriptions.unsubscribePullRequest.mockClear();
    expect(
      (await call('unwatch_pull_request', { repository: 'acme-labs/app', number: 7 })).content,
    ).toBe('You were not following pull request #7 of acme-labs/app.');
    expect(subscriptions.unsubscribePullRequest).not.toHaveBeenCalled();
  });
});
