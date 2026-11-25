import { Injectable } from '@nestjs/common';
import { z } from 'zod/v4';
import { promptText } from '../domain/bot-prompt-text.policy';
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
    z
      .number()
      .int()
      .positive()
      .describe(promptText('github/tools-pull-request-watch.repository-repository-id-from')),
  ])
  .describe(promptText('github/tools-pull-request-watch.repository-repository-owner-name'));

/**
 * Following a pull request: watch one, or stop. `list_watches` lists them with
 * the sessions followed. Neither asks, as `watch_session` does not: a watch
 * only wakes the bot when something happens on GitHub, it is bounded by the
 * merge or the wake limit, and it can be undone. A repository is followed only
 * if its owner can read it.
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
      description: promptText('github/tools-pull-request-watch.watch-pull-request', {
        subscriptionWakeLimit: String(BOT_SUBSCRIPTION_WAKE_LIMIT),
        subscriptionsPerBot: String(BOT_SUBSCRIPTIONS_PER_BOT),
      }),
      input: z.object({
        repository,
        number: z.number().int().positive().describe('The pull request number.'),
        purpose: z
          .string()
          .min(1)
          .max(BOT_SUBSCRIPTION_PURPOSE_MAX)
          .optional()
          .describe(promptText('github/tools-pull-request-watch.watch-pull-request-purpose')),
      }),
      run: async (input, context) => {
        const { subscription, pull } = await this.watches.watch(
          context,
          input.repository,
          input.number,
          input.purpose ?? null,
        );
        const ref = subscription.pullRequest;
        return promptText(
          'github/tools-pull-request-watch.watch-pull-request-follow-pull-request',
          {
            number: String(pull.number),
            repository: String(ref?.repository),
            installationId: pull.installationId,
            githubRepoId: String(ref?.githubRepoId),
          },
        );
      },
    });
  }

  private unwatchPullRequest(): BotToolDefinition {
    return defineBotTool({
      name: 'unwatch_pull_request',
      scope: 'pulls:read',
      description: promptText('github/tools-pull-request-watch.unwatch-pull-request'),
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
