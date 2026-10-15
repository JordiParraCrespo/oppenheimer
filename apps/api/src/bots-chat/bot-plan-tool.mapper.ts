import { TASK_STATUSES, type TaskStatus } from '@oppenheimer/shared';
import { type ProjectPlanSummary } from '@oppenheimer/shared/plan';
import { z } from 'zod/v4';
import type { ProjectEntity } from './../projects/domain/project.entity';
import type { PlanActor } from './../tasks/domain/plan-change.types';
import type { TaskEntity } from './../tasks/domain/task.entity';
import { type BotToolCallContext } from './application/bot-tool.factory';
import { cut, formatToolTime } from './domain/bot-tool-text.policy';

/**
 * How the plan tools write what they read (`25-bots.md` §4.3): tasks,
 * projects and summaries as labelled lines, the day in the sender's zone, and
 * the actor the bot writes as. Pure.
 */
/** The board's columns as a person reads them. */
export const COLUMN_NAMES: Record<TaskStatus, string> = {
  later: 'Later',
  todo: 'To do',
  doing: 'In progress',
  done: 'Done',
};

/** The most tasks one `list_tasks` call returns. */
export const TASKS_LIMIT_MAX = 50;

/** A calendar day, `YYYY-MM-DD`, that exists. */
export const calendarDate = z.iso.date();
/** A time of day, `HH:MM`, 24-hour. */
export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM, 24-hour');

export const statusInput = z
  .enum(TASK_STATUSES)
  .describe('The column: later, todo (To do), doing (In progress) or done.');
export const expectedVersionInput = z
  .number()
  .int()
  .min(1)
  .describe(
    'The version you last read the task at (list_tasks or get_task shows it as "v<n>"). If someone changed the task since, the write is refused: read it again and decide again.',
  );

/** A due time needs its day, as the shared task schemas say. */
export const dueTimeHasDate = (value: { due_date?: string | null; due_time?: string | null }) =>
  !value.due_time || Boolean(value.due_date);

/** The bot, acting for its owner: Plan's log names both. */
export function botActor(context: BotToolCallContext): PlanActor {
  return { type: 'agent', userId: context.owner.userId, agentId: context.botId };
}

/** The sender's calendar day, `YYYY-MM-DD`: what is overdue depends on where they are. */
export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function describeProject(project: ProjectEntity, context: BotToolCallContext): string {
  const parts = [
    `${project.repositories.length} repositories`,
    `default host ${project.defaultHostId ?? 'none'}`,
    `default agent ${project.defaultAgent ?? 'none'}`,
  ];
  if (project.isUnassigned) parts.push('Unassigned: where work with no project goes');
  if (project.archivedAt)
    parts.push(`archived ${formatToolTime(project.archivedAt, context.timeZone)}`);
  return `${project.id} "${project.name}" [${parts.join('; ')}]`;
}

export function describeDue(task: TaskEntity): string {
  if (!task.dueDate) return 'no due date';
  return `due ${task.dueDate}${task.dueTime ? ` ${task.dueTime}` : ''}`;
}

export function describeTask(task: TaskEntity): string {
  const parts = [
    COLUMN_NAMES[task.status],
    `v${task.version}`,
    `project ${task.projectId}`,
    `milestone ${task.milestoneId ?? 'none'}`,
    describeDue(task),
  ];
  if (task.blockedReason) parts.push(`blocked: ${task.blockedReason}`);
  return `${task.id} "${task.title}" [${parts.join('; ')}]`;
}

export function describeTaskInFull(task: TaskEntity, context: BotToolCallContext): string {
  const sessions = task.sessions.map(
    (link) =>
      `  - session ${link.sessionId} (${link.origin}, ${formatToolTime(link.linkedAt, context.timeZone)})`,
  );
  return [
    `Task ${task.id} "${task.title}"`,
    `- column: ${COLUMN_NAMES[task.status]} (${task.status})`,
    `- version: v${task.version}`,
    `- project: ${task.projectId}`,
    `- milestone: ${task.milestoneId ?? 'none'}`,
    `- due: ${describeDue(task)}`,
    `- blocked: ${task.blockedReason ?? 'no'}`,
    `- completed: ${task.completedAt ? formatToolTime(task.completedAt, context.timeZone) : 'no'}`,
    `- updated: ${formatToolTime(task.updatedAt, context.timeZone)}`,
    sessions.length
      ? `- sessions (${sessions.length}):\n${sessions.join('\n')}`
      : '- sessions: none',
    task.notes ? `- notes:\n${cut(task.notes, 2_000)}` : '- notes: none',
  ].join('\n');
}

export function describeSummary(summary: ProjectPlanSummary, name: string | undefined): string {
  const lines = [
    `Project ${summary.projectId}${name ? ` "${name}"` : ''}: ${summary.status.replace('_', ' ')}, ${summary.done} of ${summary.total} tasks done`,
  ];
  lines.push(
    summary.doing.length
      ? `- in progress: ${summary.doing.map((ref) => `${ref.taskId} "${ref.title}"`).join(', ')}`
      : '- in progress: nothing',
  );
  lines.push(
    summary.needsInput.length
      ? `- needs the person:\n${summary.needsInput
          .map(
            (item) =>
              `  - ${item.taskId} "${item.title}" ${item.reason === 'blocked' ? `blocked: ${item.detail}` : `overdue since ${item.detail}`}`,
          )
          .join('\n')}`
      : '- needs the person: nothing',
  );
  lines.push(
    summary.nextDue
      ? `- next due: ${summary.nextDue.taskId} "${summary.nextDue.title}" on ${summary.nextDue.dueDate}`
      : '- next due: no open task has a due date',
  );
  lines.push(
    summary.milestones.length
      ? `- milestones:\n${summary.milestones
          .map(
            (milestone) =>
              `  - ${milestone.milestoneId} "${milestone.name}" ${milestone.done} of ${milestone.total} done; ${milestone.targetDate ? `target ${milestone.targetDate}` : 'no target date'}${milestone.completed ? '; complete' : ''}`,
          )
          .join('\n')}`
      : '- milestones: none',
  );
  return lines.join('\n');
}
