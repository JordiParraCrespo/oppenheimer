import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  AUTOMATION_RUN_STATUSES,
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
import { cut, formatToolList, formatToolTime } from '../domain/bot-tool-text.policy';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  defineBotTool,
} from './bot-tool.factory';

/** The most automations one `list_automations` call returns. */
const AUTOMATIONS_LIMIT_MAX = 50;
/** The most runs one `run_history` call returns. */
const RUNS_LIMIT_MAX = 25;
const PROMPT_MAX = 1_500;

const TEST_RESULTS_NOTE =
  "A run's status says whether its session finished, not whether tests passed: test results are not known unless the session's result says so (read it with get_session).";

/**
 * Automations (`25-bots.md` §4.5), the reads: the workspace's automations,
 * one with its triggers and settings, and their past runs. Making, changing,
 * running and pausing one ask the owner first.
 */
@Injectable()
export class BotAutomationToolsFactory implements BotToolArea {
  constructor(private readonly queryBus: QueryBus) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.listAutomations(), this.getAutomation(), this.runHistory()];
  }

  private listAutomations(): BotToolDefinition {
    return defineBotTool({
      name: 'list_automations',
      scope: 'automations:read',
      description: `Lists the workspace's automations (a saved task a coding agent runs on a schedule, on a GitHub event, or by hand), each with its triggers, whether it is paused or running, and its last run. Filter by project; at most ${AUTOMATIONS_LIMIT_MAX} per call. Use get_automation for one automation's settings and prompt, and run_history for its runs.`,
      input: z.object({
        project_id: z
          .uuid()
          .optional()
          .describe('Only automations of this project (an id from list_projects).'),
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
            ? 'That project has no automations.'
            : 'The workspace has no automations. The person makes one from Automations in the console.',
          {
            shown: shown.length,
            total: listing.automations.length,
            hint: 'Filter by project_id, or raise limit.',
          },
        );
      },
    });
  }

  private getAutomation(): BotToolDefinition {
    return defineBotTool({
      name: 'get_automation',
      scope: 'automations:read',
      description: `Reads one automation: its triggers and when each fires next, the host, agent, model and permission its runs use, the repositories it works in, its limits, its prompt, and a digest of its last ${RUN_HISTORY_DAYS} days of runs. Use run_history for the runs themselves.`,
      input: z.object({
        automation_id: z.uuid().describe('An automation id from list_automations.'),
      }),
      run: async (input, context) => {
        const { automation, digest } = await this.queryBus.execute<
          FindAutomationQuery,
          AutomationDetail
        >(new FindAutomationQuery({ scope: context.owner, automationId: input.automation_id }));
        const revision = automation.revision;
        const lines = [
          `Automation ${automation.id} "${automation.name}"`,
          `- state: ${describeState(automation)}`,
          `- project: ${automation.projectId}`,
          `- runs on: host ${revision.hostId}; agent ${revision.agent}${revision.model ? `, model ${revision.model}` : ''}; permission ${revision.permission}${revision.effort ? `; effort ${revision.effort}` : ''}`,
          `- repositories: ${revision.repositories.length ? revision.repositories.map((repository) => repository.fullName).join(', ') : 'none (it runs in no checkout)'}`,
          `- revision: ${revision.number}, saved ${formatToolTime(revision.createdAt, context.timeZone)}`,
          `- when another run is still live: ${automation.overlap ?? 'the workspace default'}`,
          `- hourly cap: ${automation.maxRunsPerHour === null ? "the workspace's" : `${automation.maxRunsPerHour} runs`}`,
          'Triggers:',
          ...(automation.triggers.length
            ? automation.triggers.map((trigger) => `  - ${describeTrigger(trigger, context)}`)
            : ['  - none: it runs only when someone runs it by hand']),
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
      scope: 'automations:read',
      description: `Lists automation runs, newest first: each run's cause, status, when it fired, and the session it started. Filter by automation, project, status or window (24h, 7d, 30d); at most ${RUNS_LIMIT_MAX} per call. Runs that never became a session (skipped, expired) are left out unless asked for by status. A run's status is not its test results; read the session with get_session for what the agent reported.`,
      input: z.object({
        automation_id: z
          .uuid()
          .optional()
          .describe('Only runs of this automation (an id from list_automations).'),
        project_id: z.uuid().optional().describe('Only runs of this project’s automations.'),
        status: z
          .array(z.enum(AUTOMATION_RUN_STATUSES))
          .min(1)
          .optional()
          .describe(
            'Only these statuses. Default: queued, running, completed, failed and cancelled.',
          ),
        window: z.enum(RUN_WINDOWS).default('7d').describe('How far back: 24h, 7d or 30d.'),
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
          `No runs in the last ${input.window} match. That says nothing ran, not that anything is wrong.`,
          {
            shown: page.items.length,
            total: page.total,
            hint: 'Narrow by automation_id, status or window, or raise limit.',
          },
        );
        if (page.items.length === 0) return listing;
        const { counts } = page;
        return [
          listing,
          `In this window: ${counts.completed} completed, ${counts.failed} failed, ${counts.running} running, of ${counts.all}.`,
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
    `project ${automation.projectId}`,
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

function describeTrigger(trigger: AutomationTriggerProps, context: BotToolCallContext): string {
  if (trigger.source === 'schedule') {
    const { config } = trigger;
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
    return `Runs: none in the last ${RUN_HISTORY_DAYS} days.`;
  }
  return [
    `Runs: ${digest.runCount} in the last ${RUN_HISTORY_DAYS} days${digest.running ? ', one live now' : ''}. Latest:`,
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
