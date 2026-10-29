import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { GITHUB_EVENT_TYPES, SCHEDULE_FREQUENCIES } from '@oppenheimer/shared/automations';
import { z } from 'zod/v4';
import { DeleteBotRoutineCommand } from '../../automations/commands/delete-bot-routine/delete-bot-routine.command';
import { RunBotRoutineCommand } from '../../automations/commands/run-bot-routine/run-bot-routine.command';
import {
  type BotRoutineChanges,
  SaveBotRoutineCommand,
} from '../../automations/commands/save-bot-routine/save-bot-routine.command';
import type { AutomationEntity } from '../../automations/domain/automation.entity';
import type { AutomationListing } from '../../automations/domain/automation-read.types';
import { FindBotRoutinesQuery } from '../../automations/queries/find-bot-routines/find-bot-routines.query';
import { routineTriggers } from '../bot-routine-tool.mapper';
import { ROUTINE_ACTIONS, routineCallAsks } from '../domain/bot-routine.policy';
import { idempotencyKeyOf } from '../domain/bot-tool-idempotency.policy';
import { cut, formatToolList, formatToolTime } from '../domain/bot-tool-text.policy';
import { describeTrigger } from './bot-automation-tools.factory';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  BotToolRefusal,
  defineBotTool,
} from './bot-tool.factory';

const PROMPT_MAX = 8_000;
const NAME_MAX = 200;
const TRIGGERS_MAX = 5;

const scheduleTrigger = z.object({
  source: z.literal('schedule'),
  frequency: z
    .enum(SCHEDULE_FREQUENCIES)
    .describe(
      'once (needs date), hourly (at minute), daily, weekdays, weekly (needs days), monthly (needs day_of_month).',
    ),
  hour: z.number().int().min(0).max(23).default(9),
  minute: z.number().int().min(0).max(59).default(0),
  days: z
    .array(z.number().int().min(0).max(6))
    .optional()
    .describe('Weekly: 0 = Sunday … 6 = Saturday.'),
  day_of_month: z.number().int().min(1).max(28).optional(),
  date: z.string().optional().describe('Once: YYYY-MM-DD.'),
  timezone: z.string().optional().describe("An IANA zone; default the sender's."),
});

const githubTrigger = z.object({
  source: z.literal('github'),
  event: z.enum(GITHUB_EVENT_TYPES),
  repositories: z
    .array(z.number().int().positive())
    .min(1)
    .describe('GitHub repository ids (list_repositories).'),
  branch: z.string().optional().describe('Only for this branch; any branch when absent.'),
});

const routineInput = z.object({
  action: z
    .enum(ROUTINE_ACTIONS)
    .describe('What to do. Every action but list answers your whole list of routines.'),
  routine_id: z
    .uuid()
    .optional()
    .describe('The routine to act on (from list); not for create or list.'),
  name: z.string().trim().min(1).max(NAME_MAX).optional(),
  prompt: z
    .string()
    .trim()
    .min(1)
    .max(PROMPT_MAX)
    .optional()
    .describe('What you will do each time it runs, written to yourself.'),
  triggers: z
    .array(z.union([scheduleTrigger, githubTrigger]))
    .min(1)
    .max(TRIGGERS_MAX)
    .optional()
    .describe('When it runs; any one starts a run. Replaces the set on update.'),
  enabled: z.boolean().optional().describe('Create only: start paused with false. Default true.'),
});

const input = routineInput
  .refine((call) => call.action !== 'create' || (call.name && call.prompt && call.triggers), {
    message: 'create needs a name, a prompt and at least one trigger',
  })
  .refine((call) => ['list', 'create'].includes(call.action) || call.routine_id, {
    message: 'this action needs routine_id',
  });

type RoutineCall = z.output<typeof input>;

/**
 * A bot's own routines (`26-bot-routines.md` §4), as Grok Bot has them: one
 * tool, made and changed in chat. Which calls ask the owner first is
 * `routineCallAsks`: everything but listing and pausing. Every action
 * answers the whole list again, so the bot never acts on a stale picture.
 */
@Injectable()
export class BotRoutineToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'automations' as const;

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [this.updateRoutine()];
  }

  /**
   * One tool, two bindings of it: the asking one for the calls the owner
   * consents to and the direct one for the rest, picked per call by
   * `routineCallAsks`. The shared tool binding stays a yes or a no; the
   * per-call rule is this tool's own.
   */
  private updateRoutine(): BotToolDefinition {
    const asking = defineBotTool({ ...this.routineSpec(), asks: true });
    const direct = defineBotTool(this.routineSpec());
    return {
      ...asking,
      bind: (context) => {
        const ask = asking.bind(context);
        const run = direct.bind(context);
        return {
          ...ask,
          run: (call, options) => {
            const action = routineInput.shape.action.safeParse(actionOf(call));
            // An action the schema refuses goes to the asking binding, whose
            // own validation answers it as any bad call is answered.
            return action.success && !routineCallAsks(action.data)
              ? run.run(call, options)
              : ask.run(call, options);
          },
        };
      },
    };
  }

  private routineSpec() {
    return {
      name: 'update_routine',
      scope: 'automations:write' as const,
      description: `Your routines: tasks you run on your own, on a schedule (your heartbeat: "every weekday at 9, check open PRs") or when a GitHub event happens. list them; create one (a name, a prompt written to yourself, and one or more triggers); update, pause, resume or delete one; or run_now to run one at once. Everything but list and pause asks the person first. When a routine runs, you get a turn opened by it, with nobody writing to you. Use it when the person asks you to do something regularly or when something happens; a one-off task is not a routine.`,
      input,
      normalize: (call: RoutineCall, context: BotToolCallContext) => this.checked(call, context),
      summarize: async (call: RoutineCall, context: BotToolCallContext) => {
        if (call.action === 'create') {
          const when = (call.triggers ?? []).map((trigger) => describeCall(trigger)).join(' or ');
          return `Save routine "${call.name}": ${when}. ${cut(call.prompt ?? '', 160)}`;
        }
        const routine = await this.routineOf(call.routine_id, context);
        const verbs: Record<string, string> = {
          update: 'Change',
          resume: 'Resume',
          delete: 'Delete',
          run_now: 'Run',
        };
        const verb = verbs[call.action] ?? call.action;
        return `${verb} routine "${routine.name}"`;
      },
      run: async (call: RoutineCall, context: BotToolCallContext) => {
        await this.act(this.checked(call, context), context);
        return this.listing(context);
      },
    };
  }

  /** The call with its triggers checked, or the refusal that says what to fix. */
  private checked(call: RoutineCall, context: BotToolCallContext): RoutineCall {
    if (!call.triggers) return call;
    const planned = routineTriggers(call.triggers, context.timeZone);
    if ('refusal' in planned) throw new BotToolRefusal(planned.refusal);
    return call;
  }

  private async act(call: RoutineCall, context: BotToolCallContext): Promise<void> {
    const changes = (fields: RoutineCall): BotRoutineChanges => {
      const planned = fields.triggers ? routineTriggers(fields.triggers, context.timeZone) : null;
      return {
        name: fields.name,
        prompt: fields.prompt,
        triggers: planned && 'triggers' in planned ? planned.triggers : undefined,
        enabled: fields.enabled,
      };
    };
    const save = (routineId: string | null, routineChanges: BotRoutineChanges) =>
      this.commandBus.execute(
        new SaveBotRoutineCommand({
          scope: context.owner,
          botId: context.botId,
          routineId,
          changes: routineChanges,
          credentialScopes: context.credentialScopes,
        }),
      );
    if (call.action === 'list') return;
    if (call.action === 'create') {
      await save(null, changes(call));
      return;
    }
    const routine = await this.routineOf(call.routine_id, context);
    switch (call.action) {
      case 'update':
        await save(routine.id, { ...changes(call), enabled: undefined });
        return;
      case 'pause':
        await save(routine.id, { enabled: false });
        return;
      case 'resume':
        await save(routine.id, { enabled: true });
        return;
      case 'delete':
        await this.commandBus.execute(
          new DeleteBotRoutineCommand({
            scope: context.owner,
            botId: context.botId,
            routineId: routine.id,
          }),
        );
        return;
      case 'run_now':
        await this.commandBus.execute(
          new RunBotRoutineCommand({
            scope: context.owner,
            botId: context.botId,
            routineId: routine.id,
            idempotencyKey: idempotencyKeyOf(context.turnId, call),
          }),
        );
        return;
    }
  }

  /** One of this bot's routines; another bot's, or none, is refused in words. */
  private async routineOf(
    routineId: string | undefined,
    context: BotToolCallContext,
  ): Promise<AutomationEntity> {
    const { automations } = await this.routines(context);
    const routine = automations.find((candidate) => candidate.id === routineId);
    if (!routine) {
      throw new BotToolRefusal(
        `No routine of yours has the id ${routineId ?? '(none)'}. Use update_routine list for their ids.`,
      );
    }
    return routine;
  }

  private routines(context: BotToolCallContext): Promise<AutomationListing> {
    return this.queryBus.execute<FindBotRoutinesQuery, AutomationListing>(
      new FindBotRoutinesQuery({ scope: context.owner, botId: context.botId }),
    );
  }

  private async listing(context: BotToolCallContext): Promise<string> {
    const { automations, digests } = await this.routines(context);
    return formatToolList(
      'Your routines',
      automations.map((routine) => {
        const lastRun = digests.get(routine.id)?.lastRuns[0];
        const parts = [
          routine.isPaused ? 'paused' : 'on',
          `when: ${routine.triggers.map((trigger) => describeTrigger(trigger, context)).join(' or ')}`,
          lastRun
            ? `last run ${lastRun.status} ${formatToolTime(lastRun.createdAt, context.timeZone)}`
            : 'no runs yet',
        ];
        return `${routine.id} "${routine.name}" [${parts.join('; ')}]\n  prompt: ${cut(routine.revision.prompt, 300)}`;
      }),
      'You have no routines. Create one when the person asks you to do something regularly.',
      { shown: automations.length, total: automations.length, hint: '' },
    );
  }
}

/** A trigger as the card states it, before it is saved. */
function describeCall(trigger: NonNullable<RoutineCall['triggers']>[number]): string {
  if (trigger.source === 'github') {
    return `GitHub ${trigger.event}${trigger.branch ? ` on ${trigger.branch}` : ''}`;
  }
  const at = `${String(trigger.hour).padStart(2, '0')}:${String(trigger.minute).padStart(2, '0')}`;
  return trigger.frequency === 'hourly'
    ? `hourly at minute ${trigger.minute}`
    : `${trigger.frequency} at ${at}`;
}

/** The action a raw call names, before the schema has read it. */
function actionOf(call: unknown): unknown {
  return typeof call === 'object' && call !== null && 'action' in call ? call.action : undefined;
}
