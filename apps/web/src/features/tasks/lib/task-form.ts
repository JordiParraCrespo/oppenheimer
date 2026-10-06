import type { TaskEntity } from '@oppenheimer/frontend-consumer';
import { addDays, weekdayOf } from '@oppenheimer/frontend-web';
import type { CreateTaskDto, createTaskSchema, TaskStatus } from '@oppenheimer/shared/schemas/task';
import type { input } from 'zod';

/** What the task form holds: the create schema's input. */
export type TaskFormInput = input<typeof createTaskSchema>;
/** What it hands back once the schema has parsed it. */
export type TaskFormOutput = CreateTaskDto;

/** The task dialog's starting values: the create schema's, with every field present. */
export type TaskFormValues = Omit<CreateTaskDto, 'status' | 'projectId' | 'notes'> & {
  status: TaskStatus;
  projectId: string;
  notes: string;
};

/** A new task's values: filed where the board is filtered, in the column it was asked from. */
export function newTaskValues(
  projectId: string,
  goalId: string | null,
  status: TaskStatus = 'todo',
): TaskFormValues {
  return {
    title: '',
    notes: '',
    status,
    projectId,
    goalId,
    dueDate: null,
    dueTime: null,
  };
}

export function taskValues(task: TaskEntity): TaskFormValues {
  return {
    title: task.title,
    notes: task.notes,
    status: task.status,
    projectId: task.projectId,
    goalId: task.goalId,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
  };
}

/** The due date's one-click days: today, tomorrow, next Monday. */
export function dueQuickDays(today: string) {
  return {
    today,
    tomorrow: addDays(today, 1),
    nextMonday: addDays(today, 7 - weekdayOf(today)),
  };
}

/** A goal's target's one-click days: the end of this month, three months on. */
export function targetQuickDays(today: string) {
  const [year, month] = today.split('-').map(Number);
  const endOfMonth = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { endOfMonth, inThreeMonths: addDays(today, 90) };
}
