import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { TASK_BLOCKED_REASON_MAX, TASK_NOTES_MAX, TASK_TITLE_MAX } from '@oppenheimer/shared';
import { type ProjectPlanSummary, totalPlan } from '@oppenheimer/shared/plan';
import { z } from 'zod/v4';
import type { ProjectEntity } from '../../projects/domain/project.entity';
import { FindProjectQuery } from '../../projects/queries/find-project/find-project.query';
import { FindProjectsQuery } from '../../projects/queries/find-projects/find-projects.query';
import { CreateTaskCommand } from '../../tasks/commands/create-task/create-task.command';
import { MoveTaskCommand } from '../../tasks/commands/move-task/move-task.command';
import { UpdateTaskCommand } from '../../tasks/commands/update-task/update-task.command';
import type { TaskEntity } from '../../tasks/domain/task.entity';
import { FindPlanSummaryQuery } from '../../tasks/queries/find-plan-summary/find-plan-summary.query';
import { FindTaskQuery } from '../../tasks/queries/find-task/find-task.query';
import { FindTasksQuery } from '../../tasks/queries/find-tasks/find-tasks.query';
import {
  botActor,
  COLUMN_NAMES,
  calendarDate,
  describeProject,
  describeProjectInFull,
  describeSummary,
  describeTask,
  describeTaskInFull,
  dueTimeHasDate,
  expectedVersionInput,
  priorityInput,
  statusInput,
  TASKS_LIMIT_MAX,
  timeOfDay,
  todayIn,
} from '../bot-plan-tool.mapper';
import { promptText } from '../domain/bot-prompt-text.policy';
import { formatToolList } from '../domain/bot-tool-text.policy';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  defineBotTool,
} from './bot-tool.factory';

/**
 * Projects and the plan, the tools that run without asking: reading projects,
 * tasks and where each project stands, and adding, editing and moving tasks.
 * Every write is made as an agent acting for the owner, so Plan's log names the
 * bot and the person. Making, changing and archiving projects, and moving a
 * session between them, are `BotProjectToolsFactory`'s.
 */
@Injectable()
export class BotPlanToolsFactory implements BotToolArea {
  /** Where Settings → Permissions lists these tools. */
  readonly group = 'plan' as const;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  definitions(): readonly BotToolDefinition[] {
    return [
      this.listProjects(),
      this.getProject(),
      this.listTasks(),
      this.getTask(),
      this.planSummary(),
      this.createTask(),
      this.updateTask(),
      this.moveTask(),
    ];
  }

  private listProjects(): BotToolDefinition {
    return defineBotTool({
      name: 'list_projects',
      readOnly: true,
      scope: 'projects:read',
      description: promptText('plan/tools.list-projects'),
      input: z.object({
        include_archived: z
          .boolean()
          .default(false)
          .describe(promptText('plan/tools.list-projects-include-archived')),
      }),
      run: async (input, context) => {
        const projects = await this.queryBus.execute<FindProjectsQuery, ProjectEntity[]>(
          new FindProjectsQuery({
            scope: context.owner,
            includeArchived: input.include_archived,
          }),
        );
        return formatToolList(
          'Projects',
          projects.map((project) => describeProject(project, context)),
          promptText('plan/tools.list-projects-there-projects-task'),
        );
      },
    });
  }

  private getProject(): BotToolDefinition {
    return defineBotTool({
      name: 'get_project',
      readOnly: true,
      scope: 'projects:read',
      description: promptText('plan/tools.get-project'),
      input: z.object({
        project_id: z.uuid().describe(promptText('plan/tools.get-project-project-id')),
      }),
      run: async (input, context) => {
        const project = await this.queryBus.execute<FindProjectQuery, ProjectEntity>(
          new FindProjectQuery({ scope: context.owner, projectId: input.project_id }),
        );
        return describeProjectInFull(project, context);
      },
    });
  }

  private listTasks(): BotToolDefinition {
    return defineBotTool({
      name: 'list_tasks',
      readOnly: true,
      scope: 'tasks:read',
      description: promptText('plan/tools.list-tasks', { tasksLimitMax: String(TASKS_LIMIT_MAX) }),
      input: z
        .object({
          project_id: z.uuid().optional().describe(promptText('plan/tools.list-tasks-project-id')),
          milestone_id: z
            .uuid()
            .optional()
            .describe(promptText('plan/tools.list-tasks-milestone-id')),
          status: statusInput.optional(),
          due_from: calendarDate.optional().describe(promptText('plan/tools.list-tasks-due-from')),
          due_to: calendarDate.optional().describe(promptText('plan/tools.list-tasks-due-to')),
          limit: z.number().int().min(1).max(TASKS_LIMIT_MAX).default(25),
        })
        .refine((value) => !value.due_from || !value.due_to || value.due_from <= value.due_to, {
          path: ['due_to'],
          message: 'due_to is before due_from',
        }),
      run: async (input, context) => {
        const tasks = await this.queryBus.execute<FindTasksQuery, TaskEntity[]>(
          new FindTasksQuery({
            scope: context.owner,
            filter: {
              projectId: input.project_id,
              milestoneId: input.milestone_id,
              dueFrom: input.due_from,
              dueTo: input.due_to,
            },
          }),
        );
        const matching = input.status
          ? tasks.filter((task) => task.status === input.status)
          : tasks;
        const shown = matching.slice(0, input.limit);
        return formatToolList('Tasks', shown.map(describeTask), 'No tasks match.', {
          shown: shown.length,
          total: matching.length,
          hint: promptText('plan/tools.list-tasks-hint'),
        });
      },
    });
  }

  private getTask(): BotToolDefinition {
    return defineBotTool({
      name: 'get_task',
      readOnly: true,
      scope: 'tasks:read',
      description: promptText('plan/tools.get-task'),
      input: z.object({ task_id: z.uuid().describe('A task id from list_tasks.') }),
      run: async (input, context) => {
        const task = await this.readTask(input.task_id, context);
        return describeTaskInFull(task, context);
      },
    });
  }

  private planSummary(): BotToolDefinition {
    return defineBotTool({
      name: 'plan_summary',
      readOnly: true,
      scope: 'tasks:read',
      description: promptText('plan/tools.plan-summary'),
      input: z.object({
        project_id: z.uuid().optional().describe(promptText('plan/tools.plan-summary-project-id')),
      }),
      run: async (input, context) => {
        const [summaries, projects] = await Promise.all([
          this.queryBus.execute<FindPlanSummaryQuery, ProjectPlanSummary[]>(
            new FindPlanSummaryQuery({
              scope: context.owner,
              projectId: input.project_id,
              today: todayIn(context.timeZone),
            }),
          ),
          this.queryBus.execute<FindProjectsQuery, ProjectEntity[]>(
            new FindProjectsQuery({ scope: context.owner, includeArchived: true }),
          ),
        ]);
        if (summaries.length === 0) {
          return input.project_id
            ? promptText('plan/tools.plan-summary-project-has-tasks')
            : promptText('plan/tools.plan-summary-plan-empty-project');
        }
        const names = new Map(projects.map((project) => [project.id, project.name]));
        const totals = totalPlan(summaries);
        const head = promptText('plan/tools.plan-summary-plan-tasks-done', {
          done: String(totals.done),
          total: String(totals.total),
          doing: String(totals.doing),
          needsInput: String(totals.needsInput),
          milestonesCompleted: String(totals.milestonesCompleted),
          milestones: String(totals.milestones),
        });
        return [
          head,
          ...summaries.map((summary) => describeSummary(summary, names.get(summary.projectId))),
        ].join('\n\n');
      },
    });
  }

  private createTask(): BotToolDefinition {
    return defineBotTool({
      name: 'create_task',
      scope: 'tasks:write',
      description: promptText('plan/tools.create-task', {
        taskTitleMax: String(TASK_TITLE_MAX),
        taskNotesMax: String(TASK_NOTES_MAX),
      }),
      input: z
        .object({
          title: z.string().trim().min(1).max(TASK_TITLE_MAX).describe('What the work is.'),
          notes: z.string().max(TASK_NOTES_MAX).optional().describe('Details, in Markdown.'),
          status: statusInput.default('todo'),
          project_id: z.uuid().optional().describe(promptText('plan/tools.create-task-project-id')),
          milestone_id: z
            .uuid()
            .optional()
            .describe(promptText('plan/tools.create-task-milestone-id')),
          due_date: calendarDate.optional().describe('A calendar day, YYYY-MM-DD.'),
          due_time: timeOfDay.optional().describe(promptText('plan/tools.create-task-due-time')),
          priority: priorityInput.optional(),
        })
        .refine(dueTimeHasDate, { path: ['due_time'], message: 'due_time needs a due_date' }),
      run: async (input, context) => {
        const taskId = await this.commandBus.execute<CreateTaskCommand, string>(
          new CreateTaskCommand({
            scope: context.owner,
            actor: botActor(context),
            origin: 'agent',
            idempotencyKey: null,
            userId: context.owner.userId,
            input: {
              title: input.title,
              notes: input.notes,
              status: input.status,
              projectId: input.project_id,
              milestoneId: input.milestone_id,
              dueDate: input.due_date,
              dueTime: input.due_time,
              priority: input.priority,
            },
          }),
        );
        const task = await this.readTask(taskId, context);
        return `Created task ${task.id} "${task.title}" in ${COLUMN_NAMES[task.status]}.\n${describeTaskInFull(task, context)}`;
      },
    });
  }

  private updateTask(): BotToolDefinition {
    return defineBotTool({
      name: 'update_task',
      scope: 'tasks:write',
      description: promptText('plan/tools.update-task', {
        taskBlockedReasonMax: String(TASK_BLOCKED_REASON_MAX),
      }),
      input: z
        .object({
          task_id: z.uuid().describe('A task id from list_tasks.'),
          expected_version: expectedVersionInput,
          title: z.string().trim().min(1).max(TASK_TITLE_MAX).optional(),
          notes: z.string().max(TASK_NOTES_MAX).optional().describe('Replaces the notes whole.'),
          project_id: z.uuid().optional().describe(promptText('plan/tools.update-task-project-id')),
          milestone_id: z
            .uuid()
            .nullable()
            .optional()
            .describe(promptText('plan/tools.update-task-milestone-id')),
          due_date: calendarDate
            .nullable()
            .optional()
            .describe(promptText('plan/tools.update-task-due-date')),
          due_time: timeOfDay.nullable().optional().describe('HH:MM, or null to clear.'),
          priority: priorityInput.nullable().optional(),
          blocked_reason: z
            .string()
            .trim()
            .min(1)
            .max(TASK_BLOCKED_REASON_MAX)
            .nullable()
            .optional()
            .describe(promptText('plan/tools.update-task-blocked-reason')),
        })
        .refine(
          (value) =>
            [
              'title',
              'notes',
              'project_id',
              'milestone_id',
              'due_date',
              'due_time',
              'priority',
              'blocked_reason',
            ].some((field) => value[field as keyof typeof value] !== undefined),
          { message: promptText('plan/tools.update-task-message') },
        ),
      run: async (input, context) => {
        const taskId = await this.commandBus.execute<UpdateTaskCommand, string>(
          new UpdateTaskCommand({
            scope: context.owner,
            actor: botActor(context),
            origin: 'agent',
            taskId: input.task_id,
            changes: {
              title: input.title,
              notes: input.notes,
              projectId: input.project_id,
              milestoneId: input.milestone_id,
              dueDate: input.due_date,
              dueTime: input.due_time,
              priority: input.priority,
              blockedReason: input.blocked_reason,
              expectedVersion: input.expected_version,
            },
          }),
        );
        const task = await this.readTask(taskId, context);
        return promptText('plan/tools.update-task-updated-task-now', {
          id: task.id,
          title: task.title,
          version: String(task.version),
          describeTaskInFull: describeTaskInFull(task, context),
        });
      },
    });
  }

  private moveTask(): BotToolDefinition {
    return defineBotTool({
      name: 'move_task',
      scope: 'tasks:write',
      description: promptText('plan/tools.move-task'),
      input: z.object({
        task_id: z.uuid().describe('A task id from list_tasks.'),
        status: statusInput,
        after_task_id: z
          .uuid()
          .nullable()
          .default(null)
          .describe(promptText('plan/tools.move-task-after-task-id')),
        expected_version: expectedVersionInput,
      }),
      run: async (input, context) => {
        const taskId = await this.commandBus.execute<MoveTaskCommand, string>(
          new MoveTaskCommand({
            scope: context.owner,
            actor: botActor(context),
            taskId: input.task_id,
            move: {
              status: input.status,
              afterTaskId: input.after_task_id,
              expectedVersion: input.expected_version,
            },
          }),
        );
        const task = await this.readTask(taskId, context);
        const place = input.after_task_id ? `after task ${input.after_task_id}` : 'first';
        return promptText('plan/tools.move-task-moved-task-now', {
          id: task.id,
          title: task.title,
          status: COLUMN_NAMES[task.status],
          place,
          version: String(task.version),
        });
      },
    });
  }

  private readTask(taskId: string, context: BotToolCallContext): Promise<TaskEntity> {
    return this.queryBus.execute<FindTaskQuery, TaskEntity>(
      new FindTaskQuery({ scope: context.owner, taskId }),
    );
  }
}
