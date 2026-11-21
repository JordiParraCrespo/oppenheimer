import { Injectable } from '@nestjs/common';
import {
  BOT_TASK_WAKE_DEFAULT,
  BOT_TASK_WAKE_EVENTS,
  type BotPlanWatchScope,
  type PlanTaskEventKind,
} from '@oppenheimer/shared';
import { z } from 'zod/v4';
import { promptText } from '../domain/bot-prompt-text.policy';
import {
  BOT_SUBSCRIPTION_PURPOSE_MAX,
  BOT_SUBSCRIPTIONS_PER_BOT,
} from '../domain/bot-subscription.policy';
import { BotPlanWatchResolver } from './bot-plan-watch.resolver';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  defineBotTool,
} from './bot-tool.factory';

/** What each change a bot can follow means, for the tools' descriptions. */
const EVENTS_HELP = promptText('tools/plan-watch.events-help');

const eventsInput = z
  .array(z.enum(BOT_TASK_WAKE_EVENTS))
  .min(1)
  .optional()
  .describe(
    promptText('tools/plan-watch.events', {
      taskWakeDefault: BOT_TASK_WAKE_DEFAULT.join(', '),
      eventsHelp: EVENTS_HELP,
    }),
  );

const purposeInput = z
  .string()
  .min(1)
  .max(BOT_SUBSCRIPTION_PURPOSE_MAX)
  .optional()
  .describe(promptText('tools/plan-watch.purpose'));

/**
 * Following the plan: watch a project's tasks, or one milestone's, and stop.
 * `list_watches` lists them with the sessions and pull requests followed.
 * Neither asks, as `watch_session` does not: a watch only reads, wakes the bot
 * when a person or another agent changes a task, and can be undone. Only what
 * the owner can read.
 */
@Injectable()
export class BotPlanWatchToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'plan' as const;

  constructor(private readonly watches: BotPlanWatchResolver) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      this.watchProject(),
      this.unwatchProject(),
      this.watchMilestone(),
      this.unwatchMilestone(),
    ];
  }

  private watchProject(): BotToolDefinition {
    return defineBotTool({
      name: 'watch_project',
      scope: 'tasks:read',
      description: watchDescription('project', 'every task of a project'),
      input: z.object({
        project_id: z.uuid().describe(promptText('tools/plan-watch.watch-project-project-id')),
        events: eventsInput,
        purpose: purposeInput,
      }),
      run: (input, context) =>
        this.follow(context, 'project', input.project_id, input.events, input.purpose),
    });
  }

  private watchMilestone(): BotToolDefinition {
    return defineBotTool({
      name: 'watch_milestone',
      scope: 'tasks:read',
      description: watchDescription('milestone', promptText('tools/plan-watch.watch-milestone')),
      input: z.object({
        milestone_id: z.uuid().describe('The milestone to follow.'),
        events: eventsInput,
        purpose: purposeInput,
      }),
      run: (input, context) =>
        this.follow(context, 'milestone', input.milestone_id, input.events, input.purpose),
    });
  }

  private unwatchProject(): BotToolDefinition {
    return defineBotTool({
      name: 'unwatch_project',
      scope: 'tasks:read',
      description: unwatchDescription('project'),
      input: z.object({
        project_id: z.uuid().describe(promptText('tools/plan-watch.unwatch-project-project-id')),
      }),
      run: (input, context) => this.stop(context, 'project', input.project_id),
    });
  }

  private unwatchMilestone(): BotToolDefinition {
    return defineBotTool({
      name: 'unwatch_milestone',
      scope: 'tasks:read',
      description: unwatchDescription('milestone'),
      input: z.object({
        milestone_id: z
          .uuid()
          .describe(promptText('tools/plan-watch.unwatch-milestone-milestone-id')),
      }),
      run: (input, context) => this.stop(context, 'milestone', input.milestone_id),
    });
  }

  private async follow(
    context: BotToolCallContext,
    scope: BotPlanWatchScope,
    id: string,
    events: readonly PlanTaskEventKind[] | undefined,
    purpose: string | undefined,
  ): Promise<string> {
    const taskEvents = events ?? BOT_TASK_WAKE_DEFAULT;
    const { name } = await this.watches.watch(context, { scope, id, taskEvents }, purpose ?? null);
    return promptText('tools/plan-watch.follow', {
      scope,
      name,
      id,
      taskEvents: taskEvents.join(', '),
    });
  }

  private async stop(
    context: BotToolCallContext,
    scope: BotPlanWatchScope,
    id: string,
  ): Promise<string> {
    const removed = await this.watches.unwatch(context, scope, id);
    return removed
      ? `You no longer follow ${scope} ${id}.`
      : `You were not following ${scope} ${id}.`;
  }
}

function watchDescription(scope: BotPlanWatchScope, what: string): string {
  return promptText('tools/plan-watch.watch-description', {
    what,
    scope,
    subscriptionsPerBot: String(BOT_SUBSCRIPTIONS_PER_BOT),
  });
}

function unwatchDescription(scope: BotPlanWatchScope): string {
  return promptText('tools/plan-watch.unwatch-description', { scope });
}
