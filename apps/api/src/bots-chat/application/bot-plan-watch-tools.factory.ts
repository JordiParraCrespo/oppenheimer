import { Injectable } from '@nestjs/common';
import {
  BOT_TASK_WAKE_DEFAULT,
  BOT_TASK_WAKE_EVENTS,
  type BotPlanWatchScope,
  type PlanTaskEventKind,
} from '@oppenheimer/shared';
import { z } from 'zod/v4';
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
const EVENTS_HELP =
  'created (a task was added), status_changed (moved between Not started, In progress and In review), completed (moved to Done), reopened (moved out of Done), blocked, unblocked, deleted, rescheduled (its due date changed), reassigned (moved to another project or milestone), session_linked (a session was attached to it)';

const eventsInput = z
  .array(z.enum(BOT_TASK_WAKE_EVENTS))
  .min(1)
  .optional()
  .describe(
    `The changes that wake you. Default: ${BOT_TASK_WAKE_DEFAULT.join(', ')}. One of: ${EVENTS_HELP}.`,
  );

const purposeInput = z
  .string()
  .min(1)
  .max(BOT_SUBSCRIPTION_PURPOSE_MAX)
  .optional()
  .describe('Why you follow it, in a line; you are reminded of it when it wakes you.');

/**
 * Following the plan (`27-bot-subscriptions.md` §7.2): watch a project's
 * tasks, or one milestone's, and stop. `list_watches` lists them with the
 * sessions and pull requests followed. Neither asks, as `watch_session`
 * does not: a watch only reads, wakes the bot when a person or another agent
 * changes a task, and can be undone. Only what the owner can read.
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
        project_id: z.uuid().describe('The project to follow (from list_projects).'),
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
      description: watchDescription(
        'milestone',
        "the tasks under one milestone of a project (list_tasks shows a task's milestone)",
      ),
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
        project_id: z.uuid().describe('A project you follow (from list_watches).'),
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
        milestone_id: z.uuid().describe('A milestone you follow (from list_watches).'),
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
    return `You follow the tasks of ${scope} "${name}" (${id}) and will be woken on: ${taskEvents.join(', ')}. End your turn now rather than wait for it.`;
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
  return `Subscribes you to ${what}, so you are woken with a turn of your own when one of them changes the way you name in events: by default when a task is added, moves column, is done or reopened, is blocked or unblocked, or is deleted. No need to poll list_tasks. You are told which task, what changed and whether your person did it, never its notes: read it with get_task. Your own changes never wake you. It lasts until unwatch_${scope}; watching it again replaces the events and the purpose. At most ${BOT_SUBSCRIPTIONS_PER_BOT} sessions, pull requests, projects and milestones followed at once.`;
}

function unwatchDescription(scope: BotPlanWatchScope): string {
  return `Stops following a ${scope}'s tasks: they will no longer wake you. The ${scope} itself is untouched.`;
}
