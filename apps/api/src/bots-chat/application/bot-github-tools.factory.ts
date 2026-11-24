import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { PULL_REQUEST_QUEUES } from '@oppenheimer/shared';
import { z } from 'zod/v4';
import type { GithubInstallationEntity } from '../../github/domain/github-installation.entity';
import { FindInstallationsQuery } from '../../github/queries/find-installations/find-installations.query';
import { ListInstallationRepositoriesQuery } from '../../github/queries/list-installation-repositories/list-installation-repositories.query';
import { FindPullRequestQuery } from '../../pull-requests/queries/find-pull-request/find-pull-request.query';
import { FindPullRequestActivityQuery } from '../../pull-requests/queries/find-pull-request-activity/find-pull-request-activity.query';
import { FindPullRequestCommentsQuery } from '../../pull-requests/queries/find-pull-request-comments/find-pull-request-comments.query';
import { FindPullRequestFilesQuery } from '../../pull-requests/queries/find-pull-request-files/find-pull-request-files.query';
import { FindPullRequestsQuery } from '../../pull-requests/queries/find-pull-requests/find-pull-requests.query';
import {
  ACTIVITY_SHOWN,
  describeConversation,
  describeFiles,
  describePullRequest,
  describePullRequestRow,
  describeRepository,
  FILES_SHOWN,
  LINE_COMMENTS_SHOWN,
  NONE_USABLE,
  NOT_CONNECTED,
  PULL_REQUESTS_LIMIT_MAX,
  type PullRequestActivityView,
  type PullRequestCommentView,
  type PullRequestDetailView,
  type PullRequestFileView,
  type PullRequestQueueView,
  REPOSITORIES_LIMIT_MAX,
  type RepositoryView,
  UNTRUSTED_NOTE,
} from '../bot-github-tool.mapper';
import { promptText } from '../domain/bot-prompt-text.policy';
import { formatToolList } from '../domain/bot-tool-text.policy';
import {
  type BotToolArea,
  type BotToolDefinition,
  defineBotTool,
  describeToolFailure,
} from './bot-tool.factory';

/**
 * GitHub and pull requests, the reads: which repositories
 * the workspace's installations cover, the pull request queue, and one pull
 * request with its files and conversation. Commenting, reviewing, merging
 * and review sessions are `BotPullRequestToolsFactory`, issues
 * `BotIssueToolsFactory`. Everything a stranger can write on
 * GitHub (bodies, comments, commit messages) comes back inside
 * `<github_content>`, marked as data.
 */
@Injectable()
export class BotGithubToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'github' as const;

  constructor(private readonly queryBus: QueryBus) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.listRepositories(), this.listPullRequests(), this.getPullRequest()];
  }

  private listRepositories(): BotToolDefinition {
    return defineBotTool({
      name: 'list_repositories',
      readOnly: true,
      scope: 'repositories:read',
      description: promptText('github/tools.list-repositories', {
        repositoriesLimitMax: String(REPOSITORIES_LIMIT_MAX),
      }),
      input: z.object({
        installation_id: z
          .uuid()
          .optional()
          .describe(promptText('github/tools.list-repositories-installation-id')),
        name_contains: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional()
          .describe(promptText('github/tools.list-repositories-name-contains')),
        limit: z.number().int().min(1).max(REPOSITORIES_LIMIT_MAX).default(30),
      }),
      run: async (input, context) => {
        const installations = await this.installations(context.owner);
        if (installations.length === 0) return NOT_CONNECTED;
        const chosen = input.installation_id
          ? installations.filter((installation) => installation.id === input.installation_id)
          : installations;
        if (chosen.length === 0) {
          return promptText('github/tools.repositories-no-such-installation', {
            installationId: String(input.installation_id),
          });
        }
        const usable = chosen.filter((installation) => installation.isUsable);
        if (usable.length === 0) return NONE_USABLE;

        const lines: string[] = [];
        const notes = chosen
          .filter((installation) => !installation.isUsable)
          .map((installation) =>
            promptText('github/tools.repositories-installation-suspended', {
              id: installation.id,
              accountLogin: installation.accountLogin,
            }),
          );
        const needle = input.name_contains?.toLowerCase();
        for (const installation of usable) {
          try {
            const repositories = await this.queryBus.execute<
              ListInstallationRepositoriesQuery,
              RepositoryView[]
            >(
              new ListInstallationRepositoriesQuery({
                scope: context.owner,
                installationId: installation.id,
              }),
            );
            for (const repository of repositories) {
              if (needle && !repository.fullName.toLowerCase().includes(needle)) continue;
              lines.push(describeRepository(installation, repository, context));
            }
          } catch (error) {
            notes.push(
              promptText('github/tools.repositories-installation-unlisted', {
                id: installation.id,
                accountLogin: installation.accountLogin,
                describeToolFailure: describeToolFailure(error),
              }),
            );
          }
        }
        const shown = lines.slice(0, input.limit);
        const listing = formatToolList(
          'Repositories',
          shown,
          needle
            ? promptText('github/tools.repositories-none-match', {
                nameContains: String(input.name_contains),
              })
            : 'No repositories.',
          {
            shown: shown.length,
            total: lines.length,
            hint: promptText('github/tools.list-repositories-hint'),
          },
        );
        return [listing, ...notes].join('\n');
      },
    });
  }

  private listPullRequests(): BotToolDefinition {
    return defineBotTool({
      name: 'list_pull_requests',
      readOnly: true,
      scope: 'pulls:read',
      description: promptText('github/tools.list-pull-requests', {
        pullRequestsLimitMax: String(PULL_REQUESTS_LIMIT_MAX),
      }),
      input: z.object({
        queue: z
          .enum(PULL_REQUEST_QUEUES)
          .default('mine')
          .describe(promptText('github/tools.list-pull-requests-queue')),
        github_repo_id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(promptText('github/tools.list-pull-requests-github-repo-id')),
        limit: z.number().int().min(1).max(PULL_REQUESTS_LIMIT_MAX).default(15),
      }),
      run: async (input, context) => {
        const installations = await this.installations(context.owner);
        if (installations.length === 0) return NOT_CONNECTED;
        if (!installations.some((installation) => installation.isUsable)) return NONE_USABLE;

        const queue = await this.queryBus.execute<FindPullRequestsQuery, PullRequestQueueView>(
          new FindPullRequestsQuery({ scope: context.owner, queue: input.queue }),
        );
        const matching = queue.items.filter(
          (row) => input.github_repo_id === undefined || row.githubRepoId === input.github_repo_id,
        );
        const shown = matching.slice(0, input.limit);
        const listing = formatToolList(
          promptText('github/tools.list-pull-requests-open-pull-requests', {
            queue: input.queue,
            untrustedNote: UNTRUSTED_NOTE,
          }),
          shown.map(describePullRequestRow),
          promptText('github/tools.pull-requests-none-in-queue', {
            queue: input.queue,
            githubRepoId: input.github_repo_id ? ' for that repository' : '',
          }),
          {
            shown: shown.length,
            total: matching.length,
            hint: promptText('github/tools.list-pull-requests-hint'),
          },
        );
        const lines = [
          listing,
          promptText('github/tools.list-pull-requests-queue-sizes-mine', {
            mine: String(queue.scopes.mine),
            requested: String(queue.scopes.requested),
            watching: String(queue.scopes.watching),
          }),
        ];
        if (!queue.viewerLogin) {
          lines.push(promptText('github/tools.list-pull-requests-persons-own-github'));
        }
        if (queue.unreadable.length) {
          lines.push(
            promptText('github/tools.list-pull-requests-github-did-answer', {
              unreadable: queue.unreadable.map((gap) => `${gap.what} (${gap.refusal})`).join(', '),
            }),
          );
        }
        if (queue.filling) {
          lines.push(promptText('github/tools.list-pull-requests-some-pull-requests'));
        }
        return lines.join('\n');
      },
    });
  }

  private getPullRequest(): BotToolDefinition {
    return defineBotTool({
      name: 'get_pull_request',
      readOnly: true,
      scope: 'pulls:read',
      description: promptText('github/tools.get-pull-request', {
        filesShown: String(FILES_SHOWN),
        activityShown: String(ACTIVITY_SHOWN),
        lineCommentsShown: String(LINE_COMMENTS_SHOWN),
      }),
      input: z.object({
        installation_id: z
          .uuid()
          .describe(promptText('github/tools.get-pull-request-installation-id')),
        github_repo_id: z
          .number()
          .int()
          .positive()
          .describe(promptText('github/tools.get-pull-request-github-repo-id')),
        number: z.number().int().positive().describe('The pull request number.'),
      }),
      run: async (input, context) => {
        const props = {
          scope: context.owner,
          address: {
            kind: 'installation' as const,
            installationId: input.installation_id,
            githubRepoId: input.github_repo_id,
            number: input.number,
          },
        };
        const [detail, files, activity, comments] = await Promise.allSettled([
          this.queryBus.execute<FindPullRequestQuery, PullRequestDetailView>(
            new FindPullRequestQuery(props),
          ),
          this.queryBus.execute<FindPullRequestFilesQuery, PullRequestFileView[]>(
            new FindPullRequestFilesQuery(props),
          ),
          this.queryBus.execute<FindPullRequestActivityQuery, PullRequestActivityView[]>(
            new FindPullRequestActivityQuery(props),
          ),
          this.queryBus.execute<FindPullRequestCommentsQuery, PullRequestCommentView[]>(
            new FindPullRequestCommentsQuery(props),
          ),
        ]);
        if (detail.status === 'rejected') throw detail.reason;
        return [
          ...describePullRequest(detail.value),
          ...describeFiles(files),
          ...describeConversation(activity, comments, context),
        ].join('\n');
      },
    });
  }

  private installations(scope: AccessScope): Promise<GithubInstallationEntity[]> {
    return this.queryBus.execute<FindInstallationsQuery, GithubInstallationEntity[]>(
      new FindInstallationsQuery({ scope }),
    );
  }
}
