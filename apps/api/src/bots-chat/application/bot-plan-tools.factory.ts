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
  describeSummary,
  describeTask,
  describeTaskInFull,
  dueTimeHasDate,
  expectedVersionInput,
  statusInput,
  TASKS_LIMIT_MAX,
  timeOfDay,
  todayIn,
} from '../bot-plan-tool.mapper';
import { formatToolList, formatToolTime } from '../domain/bot-tool-text.policy';
import {
  type BotToolArea,
  type BotToolCallContext,
  type BotToolDefinition,
  defineBotTool,
} from './bot-tool.factory';

/**
 * Projects and the plan (`25-bots.md` §4.3), the tools that run without
 * asking: reading projects, tasks and where each project stands, and adding,
 * editing and moving tasks. Every write is made as an agent acting for the
 * owner, so Plan's log names the bot and the person. Deleting a task,
 * starting a session for one, and making or changing a project ask the owner
 * first, and come with the Needs input card.
 */
@Injectable()
export class BotPlanToolsFactory implements BotToolArea {
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
      scope: 'projects:read',
      description:
        "Lists the workspace's projects with their ids, how many repositories each holds, and the host and agent a new session is offered. Archived projects are left out unless include_archived is true. Use get_project for one project's repositories.",
      input: z.object({
        include_archived: z
          .boolean()
          .default(false)
          .describe('Also list retired projects, marked archived.'),
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
          'There are no projects. A task with no project is filed under Unassigned.',
        );
      },
    });
  }

  private getProject(): BotToolDefinition {
    return defineBotTool({
      name: 'get_project',
      scope: 'projects:read',
      description:
        'Reads one project: its name, its repositories with their base branches (the default marked), and the host and agent a new session is offered. Use plan_summary for how its tasks stand.',
      input: z.object({ project_id: z.uuid().describe('A project id from list_projects.') }),
      run: async (input, context) => {
        const project = await this.queryBus.execute<FindProjectQuery, ProjectEntity>(
          new FindProjectQuery({ scope: context.owner, projectId: input.project_id }),
        );
        const repositories = project.repositories.map(
          (repository) =>
            `  - ${repository.repositoryFullName} (base ${repository.baseBranch})${repository.isDefault ? ' default' : ''}`,
        );
        return [
          `Project ${project.id} "${project.name}"${project.isUnassigned ? ' (Unassigned: where work with no project goes)' : ''}`,
          `- slug: ${project.slug}`,
          `- archived: ${project.archivedAt ? formatToolTime(project.archivedAt, context.timeZone) : 'no'}`,
          `- default host: ${project.defaultHostId ?? 'none'}`,
          `- default agent: ${project.defaultAgent ?? 'none'}`,
          repositories.length
            ? `- repositories (${repositories.length}):\n${repositories.join('\n')}`
            : '- repositories: none',
          `- created: ${formatToolTime(project.createdAt, context.timeZone)}`,
        ].join('\n');
      },
    });
  }

  private listTasks(): BotToolDefinition {
    return defineBotTool({
      name: 'list_tasks',
      scope: 'tasks:read',
      description: `Lists tasks on the plan's board with their column, version, project, milestone, due date and blocked reason, filtered by project, milestone, column or due dates; at most ${TASKS_LIMIT_MAX} per call. Use get_task for a task's notes and sessions, and plan_summary for progress and what needs the person. No tasks means none match the filters, not that the board is empty.`,
      input: z
        .object({
          project_id: z.uuid().optional().describe('Only tasks of this project (list_projects).'),
          milestone_id: z.uuid().optional().describe('Only tasks under this milestone.'),
          status: statusInput.optional(),
          due_from: calendarDate.optional().describe('Due on or after this day, YYYY-MM-DD.'),
          due_to: calendarDate.optional().describe('Due on or before this day, YYYY-MM-DD.'),
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
          hint: 'Narrow by project_id, milestone_id, status or due dates, or raise limit.',
        });
      },
    });
  }

  private getTask(): BotToolDefinition {
    return defineBotTool({
      name: 'get_task',
      scope: 'tasks:read',
      description:
        'Reads one task: its title, column, version, project, milestone, due date, blocked reason, notes, and the sessions working on it. Read it again before update_task or move_task when your version may be old.',
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
      scope: 'tasks:read',
      description:
        "Says where each project stands: tasks done of total, what is in progress, what needs the person (blocked, or past its due date in the person's zone), the next task due, and each milestone's progress and target date. Pass project_id for one project. Projects with no task and no milestone are not listed.",
      input: z.object({
        project_id: z.uuid().optional().describe('Only this project (list_projects).'),
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
            ? 'That project has no tasks and no milestones yet.'
            : 'The plan is empty: no project has a task or a milestone yet.';
        }
        const names = new Map(projects.map((project) => [project.id, project.name]));
        const totals = totalPlan(summaries);
        const head = `Plan: ${totals.done} of ${totals.total} tasks done, ${totals.doing} in progress, ${totals.needsInput} need the person, ${totals.milestonesCompleted} of ${totals.milestones} milestones complete.`;
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
      description: `Adds a task to the plan's board, at the end of its column (To do unless status says otherwise). Without project_id or milestone_id it is filed under Unassigned; a milestone brings its own project. Title up to ${TASK_TITLE_MAX} characters, notes up to ${TASK_NOTES_MAX}. Use list_tasks first when the task may already exist.`,
      input: z
        .object({
          title: z.string().trim().min(1).max(TASK_TITLE_MAX).describe('What the work is.'),
          notes: z.string().max(TASK_NOTES_MAX).optional().describe('Details, in Markdown.'),
          status: statusInput.default('todo'),
          project_id: z.uuid().optional().describe('The project to file it under.'),
          milestone_id: z.uuid().optional().describe('A milestone of that project.'),
          due_date: calendarDate.optional().describe('A calendar day, YYYY-MM-DD.'),
          due_time: timeOfDay.optional().describe('HH:MM on the due day; needs due_date.'),
        })
        .refine(dueTimeHasDate, { path: ['due_time'], message: 'due_time needs a due_date' }),
      run: async (input, context) => {
        const taskId = await this.commandBus.execute<CreateTaskCommand, string>(
          new CreateTaskCommand({
            scope: context.owner,
            actor: botActor(context),
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
      description: `Edits a task's title, notes, project, milestone, due date or blocked reason; only the fields you pass change, and null clears one. Use move_task to change its column. blocked_reason (up to ${TASK_BLOCKED_REASON_MAX} characters) marks it as waiting on the person; null unblocks it. Needs the version you read.`,
      input: z
        .object({
          task_id: z.uuid().describe('A task id from list_tasks.'),
          expected_version: expectedVersionInput,
          title: z.string().trim().min(1).max(TASK_TITLE_MAX).optional(),
          notes: z.string().max(TASK_NOTES_MAX).optional().describe('Replaces the notes whole.'),
          project_id: z
            .uuid()
            .optional()
            .describe('File it under this project; a milestone of another project is dropped.'),
          milestone_id: z
            .uuid()
            .nullable()
            .optional()
            .describe("A milestone (it moves the task to the milestone's project), or null."),
          due_date: calendarDate.nullable().optional().describe('YYYY-MM-DD, or null to clear.'),
          due_time: timeOfDay.nullable().optional().describe('HH:MM, or null to clear.'),
          blocked_reason: z
            .string()
            .trim()
            .min(1)
            .max(TASK_BLOCKED_REASON_MAX)
            .nullable()
            .optional()
            .describe('Why it waits on the person, in a sentence; null unblocks it.'),
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
              'blocked_reason',
            ].some((field) => value[field as keyof typeof value] !== undefined),
          { message: 'nothing to change: pass at least one field' },
        ),
      run: async (input, context) => {
        const taskId = await this.commandBus.execute<UpdateTaskCommand, string>(
          new UpdateTaskCommand({
            scope: context.owner,
            actor: botActor(context),
            taskId: input.task_id,
            changes: {
              title: input.title,
              notes: input.notes,
              projectId: input.project_id,
              milestoneId: input.milestone_id,
              dueDate: input.due_date,
              dueTime: input.due_time,
              blockedReason: input.blocked_reason,
              expectedVersion: input.expected_version,
            },
          }),
        );
        const task = await this.readTask(taskId, context);
        return `Updated task ${task.id} "${task.title}", now at v${task.version}.\n${describeTaskInFull(task, context)}`;
      },
    });
  }

  private moveTask(): BotToolDefinition {
    return defineBotTool({
      name: 'move_task',
      scope: 'tasks:write',
      description:
        'Moves a task to a column (later, todo, doing, done), first in it or directly after another task of that column. Moving to done completes it and clears a blocked reason; moving out of done reopens it. Needs the version you read. Use update_task for anything but the column or the order.',
      input: z.object({
        task_id: z.uuid().describe('A task id from list_tasks.'),
        status: statusInput,
        after_task_id: z
          .uuid()
          .nullable()
          .default(null)
          .describe(
            'Place it directly after this task of the target column; omit or null for first.',
          ),
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
        return `Moved task ${task.id} "${task.title}" to ${COLUMN_NAMES[task.status]} (${place}), now at v${task.version}.`;
      },
    });
  }

  private readTask(taskId: string, context: BotToolCallContext): Promise<TaskEntity> {
    return this.queryBus.execute<FindTaskQuery, TaskEntity>(
      new FindTaskQuery({ scope: context.owner, taskId }),
    );
  }
}
