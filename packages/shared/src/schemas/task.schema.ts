import { z } from 'zod';
import { createSessionSchema } from './session.schema.js';

/**
 * Plan's board (`product/versions/mvp/17-plan.md`): a **task** is work a person
 * asks for, filed under a project and optionally under one of that project's
 * **goals**, in one of four columns. A task starts sessions or links existing
 * ones; the session is where the work happens.
 *
 * Dates are wall-clock: a due date is a calendar day and a due time a time of
 * day, both read in the viewer's own timezone. Nothing fires on them, so no
 * timezone is stored (`product/versions/mvp/18-plan-product.md`).
 */

/** The board's columns, in the order the board draws them. */
export const TASK_STATUSES = ['later', 'todo', 'doing', 'done'] as const;
export const taskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/**
 * The statuses attaching a session moves to In progress: work not started yet.
 * In progress and Done stay as they are (`product/versions/mvp/19-plan-tasks-and-goals.md` §5).
 */
export const TASK_STATUSES_BEFORE_WORK: readonly TaskStatus[] = ['later', 'todo'];

export const TASK_TITLE_MAX = 500;
export const TASK_NOTES_MAX = 10_000;
export const GOAL_NAME_MAX = 200;

/** A calendar day, `YYYY-MM-DD`, that is a real date. */
export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  });

/** A time of day, `HH:MM`, 24-hour. */
export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const taskTitleSchema = z.string().trim().min(1).max(TASK_TITLE_MAX);
const taskNotesSchema = z.string().max(TASK_NOTES_MAX);
const goalNameSchema = z.string().trim().min(1).max(GOAL_NAME_MAX);

/** A due time needs a due date; the console picks today when a time comes first. */
function dueTimeHasDate(value: { dueDate?: string | null; dueTime?: string | null }): boolean {
  return !value.dueTime || Boolean(value.dueDate);
}

/**
 * `POST /tasks`. Without a project the task is filed under the workspace's
 * Unassigned project, as a session is. A goal brings its own project, so a
 * `projectId` that disagrees with it is refused. New tasks go to the end of
 * their column.
 */
export const createTaskSchema = z
  .object({
    title: taskTitleSchema,
    notes: taskNotesSchema.optional(),
    status: taskStatusSchema.default('todo'),
    projectId: z.string().uuid().optional(),
    goalId: z.string().uuid().nullable().optional(),
    dueDate: calendarDateSchema.nullable().optional(),
    dueTime: timeOfDaySchema.nullable().optional(),
  })
  .refine(dueTimeHasDate, { path: ['dueTime'] });

export type CreateTaskDto = z.infer<typeof createTaskSchema>;

/**
 * `PATCH /tasks/{id}`. Every field optional; `null` clears. The status is not
 * here: a column change is a move, which also says where in the column.
 * Changing the project drops a goal of another project; choosing a goal moves
 * the task to the goal's project.
 */
export const updateTaskSchema = z
  .object({
    title: taskTitleSchema.optional(),
    notes: taskNotesSchema.optional(),
    projectId: z.string().uuid().optional(),
    goalId: z.string().uuid().nullable().optional(),
    dueDate: calendarDateSchema.nullable().optional(),
    dueTime: timeOfDaySchema.nullable().optional(),
  })
  .refine(dueTimeHasDate, { path: ['dueTime'] });

export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;

/**
 * `POST /tasks/{id}/move`: into a column, directly after another task of that
 * column, or first when `afterTaskId` is null. The board may be filtered, so
 * "after the card above where it was dropped" is the only position a client can
 * name; the server places it between that task and whatever follows it.
 */
export const moveTaskSchema = z.object({
  status: taskStatusSchema,
  afterTaskId: z.string().uuid().nullable(),
});

export type MoveTaskDto = z.infer<typeof moveTaskSchema>;

/**
 * Attaching a session moves a task that has not started to In progress, but
 * only if it is still where the person saw it when they clicked: a drag made
 * after the click wins.
 */
const seenStatusSchema = taskStatusSchema;

/**
 * `POST /tasks/{id}/sessions`: start a session for the task. The session is
 * New session's body, filed under the task's project whatever `projectId` says.
 */
export const startTaskSessionSchema = z.object({
  session: createSessionSchema,
  seenStatus: seenStatusSchema,
});

export type StartTaskSessionDto = z.infer<typeof startTaskSessionSchema>;

/** `PUT /tasks/{id}/sessions/{sessionId}`: link a session that already exists. */
export const linkTaskSessionSchema = z.object({
  seenStatus: seenStatusSchema,
});

export type LinkTaskSessionDto = z.infer<typeof linkTaskSessionSchema>;

/** `GET /tasks`. Every filter narrows; none returns the whole board. */
export const listTasksQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  goalId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  dueFrom: calendarDateSchema.optional(),
  dueTo: calendarDateSchema.optional(),
});

export type ListTasksQueryDto = z.infer<typeof listTasksQuerySchema>;

/** `POST /goals`. A goal always has a project: it is what the project is aiming for. */
export const createGoalSchema = z.object({
  name: goalNameSchema,
  projectId: z.string().uuid(),
  targetDate: calendarDateSchema.nullable().optional(),
});

export type CreateGoalDto = z.infer<typeof createGoalSchema>;

/** `PATCH /goals/{id}`. Moving a goal to another project moves its tasks with it. */
export const updateGoalSchema = z.object({
  name: goalNameSchema.optional(),
  projectId: z.string().uuid().optional(),
  targetDate: calendarDateSchema.nullable().optional(),
});

export type UpdateGoalDto = z.infer<typeof updateGoalSchema>;

/** `GET /goals`. */
export const listGoalsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
});

export type ListGoalsQueryDto = z.infer<typeof listGoalsQuerySchema>;
