import { Injectable } from '@nestjs/common';
import { z } from 'zod/v4';
import {
  BOT_SUBSCRIPTION_PURPOSE_MAX,
  BOT_SUBSCRIPTION_WAKE_LIMIT,
  BOT_SUBSCRIPTIONS_PER_BOT,
} from '../domain/bot-subscription.policy';
import { BotPullRequestWatchResolver } from './bot-pull-request-watch.resolver';
import { type BotToolArea, type BotToolDefinition, defineBotTool } from './bot-tool.factory';

/** A repository as the bot names it: `owner/name`, or the id list_repositories gives. */
const repository = z
  .union([
    z
      .string()
      .regex(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/)
      .describe('owner/name'),
    z.number().int().positive().describe('The repository id from list_repositories.'),
  ])
  .describe(
    'The repository: "owner/name", or its github_repo_id (from list_pull_requests or list_repositories).',
  );

/**
 * Following a pull request (`27-bot-subscriptions.md` §7): watch one, or
 * stop. `list_watches` lists them with the sessions followed. Neither asks,
 * as `watch_session` does not: a watch only wakes the bot when something
 * happens on GitHub, it is bounded by the merge or the wake limit, and it can
 * be undone. A repository is followed only if its owner can read it.
 */
@Injectable()
export class BotPullRequestWatchToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'github' as const;

  constructor(private readonly watches: BotPullRequestWatchResolver) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.watchPullRequest(), this.unwatchPullRequest()];
  }

  private watchPullRequest(): BotToolDefinition {
    return defineBotTool({
      name: 'watch_pull_request',
      scope: 'pulls:read',
      description: `Subscribes you to an open pull request, so you are woken with a turn of your own when a check fails or passes, a review is submitted, someone comments, or it is merged: no need to poll it. You are told what happened and by whom, never what anyone wrote: read it with get_pull_request. It ends when the pull request is merged, after ${BOT_SUBSCRIPTION_WAKE_LIMIT} wakes, or with unwatch_pull_request. Only a repository the workspace's GitHub installations let the person read; at most ${BOT_SUBSCRIPTIONS_PER_BOT} sessions and pull requests followed at once.`,
      input: z.object({
        repository,
        number: z.number().int().positive().describe('The pull request number.'),
        purpose: z
          .string()
          .min(1)
          .max(BOT_SUBSCRIPTION_PURPOSE_MAX)
          .optional()
          .describe('Why you follow it, in a line; you are reminded of it when it wakes you.'),
      }),
      run: async (input, context) => {
        const { subscription, pull } = await this.watches.watch(
          context,
          input.repository,
          input.number,
          input.purpose ?? null,
        );
        const ref = subscription.pullRequest;
        return `You follow pull request #${pull.number} of ${ref?.repository} (installation ${pull.installationId}, repository id ${ref?.githubRepoId}). You will be woken when a check fails or passes, a review is submitted, someone comments, or it is merged; end your turn now rather than wait for it.`;
      },
    });
  }

  private unwatchPullRequest(): BotToolDefinition {
    return defineBotTool({
      name: 'unwatch_pull_request',
      scope: 'pulls:read',
      description:
        'Stops following a pull request: it will no longer wake you. The pull request itself is untouched.',
      input: z.object({
        repository,
        number: z.number().int().positive().describe('The pull request number.'),
      }),
      run: async (input, context) => {
        const removed = await this.watches.unwatch(context, input.repository, input.number);
        const named = `pull request #${input.number} of ${input.repository}`;
        return removed ? `You no longer follow ${named}.` : `You were not following ${named}.`;
      },
    });
  }
}
