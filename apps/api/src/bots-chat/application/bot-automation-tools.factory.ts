import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  AUTOMATION_RUN_STATUSES,
  cronToEnglish,
  RUN_HISTORY_DAYS,
  RUN_WINDOWS,
} from '@oppenheimer/shared/automations';
import { z } from 'zod/v4';
import type { AutomationEntity } from '../../automations/domain/automation.entity';
import type { AutomationTriggerProps } from '../../automations/domain/automation.types';
import type {
  AutomationDetail,
  AutomationListing,
  AutomationRunDigest,
  RunPage,
  RunReadModel,
} from '../../automations/domain/automation-read.types';
import { FindAutomationQuery } from '../../automations/queries/find-automation/find-automation.query';
import { FindAutomationRunsQuery } from '../../automations/queries/find-automation-runs/find-automation-runs.query';
import { FindAutomationsQuery } from '../../automations/queries/find-automations/find-automations.query';
import { promptText } from '../domain/bot-prompt-text.policy';
import { cut, formatToolList, formatToolTime } from '../domain/bot-tool-text.policy';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

/** The most automations one `list_automations` call returns. */
const AUTOMATIONS_LIMIT_MAX = 50;
/** The most runs one `run_history` call returns. */
const RUNS_LIMIT_MAX = 25;
const PROMPT_MAX = 1_500;

const TEST_RESULTS_NOTE = promptText('tools/automation.test-results-note');

/**
 * Automations, the reads: the workspace's automations,
 * one with its triggers and settings, and their past runs. Making, changing,
 * running and pausing one ask the owner first.
 */
@Injectable()
export class BotAutomationToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'automations' as const;

  constructor(private readonly queryBus: QueryBus) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.listAutomations(), this.getAutomation(), this.runHistory()];
  }

  private listAutomations(): BotToolDefinition {
    return defineBotTool({
      name: 'list_automations',
      readOnly: true,
      scope: 'automations:read',
      description: promptText('tools/automation.list-automations', {
        automationsLimitMax: String(AUTOMATIONS_LIMIT_MAX),
      }),
      input: z.object({
        project_id: z
          .uuid()
          .optional()
          .describe(promptText('tools/automation.list-automations-project-id')),
        limit: z.number().int().min(1).max(AUTOMATIONS_LIMIT_MAX).default(25),
      }),
      run: async (input, context) => {
        const listing = await this.queryBus.execute<FindAutomationsQuery, AutomationListing>(
          new FindAutomationsQuery({ scope: context.owner, projectId: input.project_id }),
        );
        const shown = listing.automations.slice(0, input.limit);
        return formatToolList(
          'Automations',
          shown.map((automation) =>
            describeAutomation(automation, listing.digests.get(automation.id), context),
          ),
          input.project_id
            ? promptText('tools/automation.list-none-in-project')
            : promptText('tools/automation.list-none-in-workspace'),
          {
            shown: shown.length,
            total: listing.automations.length,
            hint: promptText('tools/automation.list-automations-hint'),
          },
        );
      },
    });
  }

  private getAutomation(): BotToolDefinition {
    return defineBotTool({
      name: 'get_automation',
      readOnly: true,
      scope: 'automations:read',
      description: promptText('tools/automation.get-automation', {
        runHistoryDays: String(RUN_HISTORY_DAYS),
      }),
      input: z.object({
        automation_id: z
          .uuid()
          .describe(promptText('tools/automation.get-automation-automation-id')),
      }),
      run: async (input, context) => {
        const { automation, digest } = await this.queryBus.execute<
          FindAutomationQuery,
          AutomationDetail
        >(new FindAutomationQuery({ scope: context.owner, automationId: input.automation_id }));
        const { target } = automation;
        // The query answers a session automation or not found; a routine is read with update_routine.
        if (target.kind !== 'session') {
          throw new BotToolRefusal(`No automation has the id ${input.automation_id}.`);
        }
        const { revision } = target;
        const lines = [
          `Automation ${automation.id} "${automation.name}"`,
          `- state: ${describeState(automation)}`,
          `- project: ${target.projectId}`,
          `- runs ${describePlace(revision)}; agent ${revision.agent}${revision.model ? `, model ${revision.model}` : ''}; permission ${revision.permission}${revision.effort ? `; effort ${revision.effort}` : ''}`,
          `- repositories: ${revision.repositories.length ? revision.repositories.map((repository) => repository.fullName).join(', ') : promptText('tools/automation.get-automation-none-runs-checkout')}`,
          `- revision: ${revision.number}, saved ${formatToolTime(revision.createdAt, context.timeZone)}`,
          promptText('tools/automation.get-automation-when-another-run', {
            overlap: automation.overlap ?? 'the workspace default',
          }),
          `- hourly cap: ${automation.maxRunsPerHour === null ? "the workspace's" : `${automation.maxRunsPerHour} runs`}`,
          'Triggers:',
          ...(automation.triggers.length
            ? automation.triggers.map((trigger) => `  - ${describeTrigger(trigger, context)}`)
            : [`  ${promptText('tools/automation.get-automation-none-runs-only')}`]),
          `Prompt:\n${cut(revision.prompt, PROMPT_MAX)}`,
          describeDigest(digest, context),
        ];
        return lines.join('\n');
      },
    });
  }

  private runHistory(): BotToolDefinition {
    return defineBotTool({
      name: 'run_history',
      readOnly: true,
      scope: 'automations:read',
      description: promptText('tools/automation.run-history', {
        runsLimitMax: String(RUNS_LIMIT_MAX),
      }),
      input: z.object({
        automation_id: z
          .uuid()
          .optional()
          .describe(promptText('tools/automation.run-history-automation-id')),
        project_id: z
          .uuid()
          .optional()
          .describe(promptText('tools/automation.run-history-project-id')),
        status: z
          .array(z.enum(AUTOMATION_RUN_STATUSES))
          .min(1)
          .optional()
          .describe(promptText('tools/automation.run-history-status')),
        window: z
          .enum(RUN_WINDOWS)
          .default('7d')
          .describe(promptText('tools/automation.run-history-window')),
        limit: z.number().int().min(1).max(RUNS_LIMIT_MAX).default(10),
      }),
      run: async (input, context) => {
        const page = await this.queryBus.execute<FindAutomationRunsQuery, RunPage>(
          new FindAutomationRunsQuery({
            scope: context.owner,
            filters: {
              automationId: input.automation_id,
              projectId: input.project_id,
              status: input.status,
              window: input.window,
              page: 1,
              limit: input.limit,
            },
          }),
        );
        const listing = formatToolList(
          `Runs, last ${input.window}`,
          page.items.map((run) => describeRun(run, context)),
          promptText('tools/automation.run-history-runs-last-match', { window: input.window }),
          {
            shown: page.items.length,
            total: page.total,
            hint: promptText('tools/automation.run-history-hint'),
          },
        );
        if (page.items.length === 0) return listing;
        const { counts } = page;
        return [
          listing,
          promptText('tools/automation.run-history-window-completed-failed', {
            completed: String(counts.completed),
            failed: String(counts.failed),
            running: String(counts.running),
            all: String(counts.all),
          }),
          TEST_RESULTS_NOTE,
        ].join('\n');
      },
    });
  }
}

function describeAutomation(
  automation: AutomationEntity,
  digest: AutomationRunDigest | undefined,
  context: BotToolCallContext,
): string {
  const triggers = automation.triggers.length
    ? automation.triggers.map((trigger) => describeTrigger(trigger, context)).join(', ')
    : 'by hand only';
  const lastRun = digest?.lastRuns[0];
  const parts = [
    describeState(automation),
    automation.target.kind === 'session' ? `project ${automation.target.projectId}` : 'a routine',
    `triggers: ${triggers}`,
    digest?.running ? 'a run is live now' : 'nothing running',
    `${digest?.runCount ?? 0} runs in ${RUN_HISTORY_DAYS} days`,
    lastRun
      ? `last run ${lastRun.status} ${formatToolTime(lastRun.createdAt, context.timeZone)}`
      : 'no runs yet',
  ];
  return `${automation.id} "${automation.name}" [${parts.join('; ')}]`;
}

function describeState(automation: AutomationEntity): string {
  if (!automation.isPaused) return 'active';
  return `paused (${automation.pausedReason ?? 'user'})`;
}

/** One trigger in words: a schedule with its zone and next slot, the GitHub event it listens for, or the mail it watches. */
export function describeTrigger(
  trigger: AutomationTriggerProps,
  context: Pick<BotToolCallContext, 'timeZone'>,
): string {
  if (trigger.source === 'schedule') {
    const { config } = trigger;
    if (config.frequency === 'cron') {
      const words = cronToEnglish(config.expression ?? '') ?? 'never';
      return `schedule cron "${config.expression ?? ''}" (${words}) ${trigger.timezone}, next ${trigger.nextFireAt ? formatToolTime(trigger.nextFireAt, context.timeZone) : 'none'}`;
    }
    const at = `${String(config.hour).padStart(2, '0')}:${String(config.minute).padStart(2, '0')}`;
    const detail =
      config.frequency === 'hourly'
        ? `at minute ${config.minute}`
        : config.frequency === 'weekly'
          ? `on days ${(config.days ?? []).join(',')} (0 = Sunday) at ${at}`
          : config.frequency === 'monthly'
            ? `on day ${config.dayOfMonth ?? 1} at ${at}`
            : config.frequency === 'once'
              ? `on ${config.date ?? '?'} at ${at}`
              : `at ${at}`;
    return `schedule ${config.frequency} ${detail} ${trigger.timezone}, next ${trigger.nextFireAt ? formatToolTime(trigger.nextFireAt, context.timeZone) : 'none'}`;
  }
  if (trigger.source === 'gmail') {
    const query = trigger.config.filter.op === 'equals' ? trigger.config.filter.value : null;
    return promptText('tools/automation.describe-trigger-gmail-mail-received', {
      connectionId: trigger.config.connectionId,
      query: query
        ? ` matching "${query}"`
        : ` ${promptText('tools/automation.describe-trigger-every-new-message')}`,
    });
  }
  const filter =
    trigger.config.filter.op === 'equals'
      ? ` where it equals "${trigger.config.filter.value}"`
      : '';
  return `${trigger.source} ${trigger.eventType} on ${trigger.config.repositories.join(', ') || 'any repository'}${filter}`;
}

function describeDigest(
  digest: AutomationRunDigest | undefined,
  context: BotToolCallContext,
): string {
  if (!digest || digest.runCount === 0) {
    return promptText('tools/automation.describe-digest-runs-none-last', {
      runHistoryDays: String(RUN_HISTORY_DAYS),
    });
  }
  return [
    promptText('tools/automation.describe-digest-runs-last-days', {
      runCount: String(digest.runCount),
      runHistoryDays: String(RUN_HISTORY_DAYS),
      running: digest.running ? ', one live now' : '',
    }),
    ...digest.lastRuns.map((run) => `  - ${describeRun(run, context)}`),
  ].join('\n');
}

function describeRun(run: RunReadModel, context: BotToolCallContext): string {
  const cause = [run.causeSummary.label, run.causeSummary.ref].filter(Boolean).join(' ');
  const when = formatToolTime(run.scheduledFor ?? run.createdAt, context.timeZone);
  const outcome =
    run.outcome === 'skipped' && run.skipReason ? `skipped (${run.skipReason})` : run.status;
  const session = run.sessionId
    ? `session ${run.sessionId}${run.branch ? ` on branch ${run.branch}` : ''}`
    : 'no session started';
  const parts = [`cause: ${run.cause}, ${cause}`, `status ${outcome}`, `at ${when}`, session];
  if (run.turn?.exitCode != null && run.turn.exitCode !== 0) {
    parts.push(`agent exited ${run.turn.exitCode}`);
  }
  return `run ${run.id} of ${run.automationId} "${run.automationName}"${run.automationDeleted ? ' (deleted)' : ''} [${parts.join('; ')}]`;
}

/** Where an automation's runs go, as a bot reads it. */
function describePlace(revision: { place: string; hostId: string | null }): string {
  if (revision.place === 'host') return `on: host ${revision.hostId}`;
  if (revision.place === 'claude-cloud') {
    return promptText('tools/automation.describe-place-claude-codes-cloud', {
      hostId: String(revision.hostId),
    });
  }
  return promptText('tools/automation.describe-place-s-cloud-owners', { place: revision.place });
}
