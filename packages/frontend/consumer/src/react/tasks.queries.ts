'use client';

import { useQuery, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  type QueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  type GoalEntity,
  type GoalInput,
  TaskEntity,
  type TaskFilter,
  type TaskInput,
  type TaskMove,
} from '../modules/tasks/task.entity';
import type { StartedTaskSession, StartTaskSessionInput } from '../modules/tasks/tasks.repository';
import { useConsumerApp } from './context';
import { sessionsKeys } from './sessions.queries';

export const tasksKeys = {
  all: ['tasks'] as const,
  lists: () => [...tasksKeys.all, 'list'] as const,
  list: (filter: TaskFilter) => [...tasksKeys.lists(), filter] as const,
  goals: () => [...tasksKeys.all, 'goals'] as const,
  goalList: () => [...tasksKeys.goals(), 'list'] as const,
};

/** The whole board, which every column, count and card reads. */
const BOARD: TaskFilter = {};

/**
 * Every task on the board, in board order. One read serves the columns, the
 * sidebar's counts and the rail's: pass `select` for less than the whole list.
 */
export function useTasks<TData = TaskEntity[]>(
  options?: Omit<UseQueryOptions<TaskEntity[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  return useQuery<TaskEntity[], Error, TData>({
    queryKey: tasksKeys.list(BOARD),
    queryFn: () => app.tasks.findAll(BOARD),
    ...options,
  });
}

/**
 * The tasks a session is on: the session header's "Back to task". A `select`
 * over the board, which the console rail keeps read on every screen, so the
 * header costs no request of its own and follows a link the moment it is made.
 */
export function useSessionTasks(sessionId: string | undefined) {
  return useTasks({
    select: (rows) =>
      sessionId
        ? rows.filter((row) => row.sessions.some((link) => link.sessionId === sessionId))
        : [],
    enabled: sessionId !== undefined,
  });
}

/** The goals of the workspace, with their progress. */
export function useGoals<TData = GoalEntity[]>(
  options?: Omit<UseQueryOptions<GoalEntity[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  const app = useConsumerApp();
  return useQuery<GoalEntity[], Error, TData>({
    queryKey: tasksKeys.goalList(),
    queryFn: () => app.tasks.findGoals(),
    ...options,
  });
}

/**
 * Write the task the server returned into the board. Ranks are fractional, so
 * a write moves no row but its own and the answer is the whole change: the
 * board is not read again. Reading it again was worse than a wasted request,
 * since a refetch that set off while a second drag was still on its way drew
 * that card back in its old place until its own answer landed.
 *
 * Goals refetch only when a count can have moved: a task joined or left a goal,
 * or one on a goal turned Done or back. `before` is the board as it was before
 * the write, for a mutation that already drew it provisionally; without the
 * board to compare against, the goals refetch.
 */
function settleTask(
  queryClient: QueryClient,
  task: TaskEntity | null,
  { removedId, before }: { removedId?: string; before?: TaskEntity[] } = {},
) {
  const id = task?.id ?? removedId;
  const rows = before ?? queryClient.getQueryData<TaskEntity[]>(tasksKeys.list(BOARD));
  const was = rows?.find((row) => row.id === id);
  queryClient.setQueryData<TaskEntity[]>(tasksKeys.list(BOARD), (current) => {
    if (!current) return current;
    const rest = current.filter((row) => row.id !== id);
    return task ? [...rest, task] : rest;
  });
  if (!rows || movesGoalProgress(was, task)) {
    void queryClient.invalidateQueries({ queryKey: tasksKeys.goals() });
  }
}

function movesGoalProgress(was: TaskEntity | undefined, now: TaskEntity | null): boolean {
  if (!was && !now) return true;
  if (!was || !now) return (was ?? now)?.goalId != null;
  return was.goalId !== now.goalId || (now.goalId !== null && was.isDone !== now.isDone);
}

export function useCreateTask(options?: UseMutationOptions<TaskEntity, Error, TaskInput>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) => app.tasks.create(input),
    ...withCacheOnSuccess(options, (task) => settleTask(queryClient, task)),
  });
}

export interface UpdateTaskVariables {
  id: string;
  input: Partial<TaskInput>;
}

export function useUpdateTask(
  options?: UseMutationOptions<TaskEntity, Error, UpdateTaskVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: UpdateTaskVariables) => app.tasks.update(id, input),
    ...withCacheOnSuccess(options, (task) => settleTask(queryClient, task)),
  });
}

export interface MoveTaskVariables extends TaskMove {
  id: string;
}

/**
 * A drag or a tick. The card moves on the drop: the board is written at once with
 * a provisional key just after the task it landed below (or before every key, at
 * the top), and the server's key replaces it. A refusal puts the board back.
 */
export function useMoveTask(
  options?: UseMutationOptions<TaskEntity, Error, MoveTaskVariables, { previous?: TaskEntity[] }>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    ...withCacheOnSuccess(options, (task, _move, context) =>
      settleTask(queryClient, task, { before: context?.previous }),
    ),
    mutationFn: ({ id, status, afterTaskId }: MoveTaskVariables) =>
      app.tasks.move(id, { status, afterTaskId }),
    onMutate: async (move) => {
      await queryClient.cancelQueries({ queryKey: tasksKeys.list(BOARD) });
      const previous = queryClient.getQueryData<TaskEntity[]>(tasksKeys.list(BOARD));
      queryClient.setQueryData<TaskEntity[]>(tasksKeys.list(BOARD), (rows) =>
        rows?.map((row) => (row.id === move.id ? provisionallyMoved(row, move, rows) : row)),
      );
      return { previous };
    },
    onError: (error, move, context, mutation) => {
      if (context?.previous) queryClient.setQueryData(tasksKeys.list(BOARD), context.previous);
      return options?.onError?.(error, move, context, mutation);
    },
  });
}

function provisionallyMoved(task: TaskEntity, move: TaskMove, rows: TaskEntity[]): TaskEntity {
  const above = move.afterTaskId ? rows.find((row) => row.id === move.afterTaskId) : undefined;
  // `''` sorts before every key; a key plus the lowest code point sorts directly after it.
  const rank = above ? `${above.rank}\u0000` : '';
  return new TaskEntity(
    task.id,
    task.projectId,
    task.goalId,
    move.status,
    rank,
    task.title,
    task.notes,
    task.dueDate,
    task.dueTime,
    move.status === 'done' ? (task.completedAt ?? new Date()) : null,
    task.sessions,
    task.createdAt,
    new Date(),
  );
}

export function useDeleteTask(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => app.tasks.remove(id),
    ...withCacheOnSuccess(options, (_data, id) => settleTask(queryClient, null, { removedId: id })),
  });
}

export interface StartTaskSessionVariables extends StartTaskSessionInput {
  id: string;
}

/** Start a session for a task; the session list learns of it on its next read. */
export function useStartTaskSession(
  options?: UseMutationOptions<StartedTaskSession, Error, StartTaskSessionVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: StartTaskSessionVariables) => app.tasks.startSession(id, input),
    ...withCacheOnSuccess(options, (started) => {
      settleTask(queryClient, started.task);
      void queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    }),
  });
}

export interface LinkTaskSessionVariables {
  id: string;
  sessionId: string;
  seenStatus: TaskEntity['status'];
}

export function useLinkTaskSession(
  options?: UseMutationOptions<TaskEntity, Error, LinkTaskSessionVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sessionId, seenStatus }: LinkTaskSessionVariables) =>
      app.tasks.linkSession(id, sessionId, seenStatus),
    ...withCacheOnSuccess(options, (task) => settleTask(queryClient, task)),
  });
}

export function useUnlinkTaskSession(
  options?: UseMutationOptions<TaskEntity, Error, { id: string; sessionId: string }>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sessionId }: { id: string; sessionId: string }) =>
      app.tasks.unlinkSession(id, sessionId),
    ...withCacheOnSuccess(options, (task) => settleTask(queryClient, task)),
  });
}

export function useCreateGoal(options?: UseMutationOptions<GoalEntity, Error, GoalInput>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GoalInput) => app.tasks.createGoal(input),
    ...withCacheOnSuccess(options, () => {
      void queryClient.invalidateQueries({ queryKey: tasksKeys.goals() });
    }),
  });
}

export interface UpdateGoalVariables {
  id: string;
  input: Partial<GoalInput>;
}

/** A goal moved to another project takes its tasks with it, so the board refetches too. */
export function useUpdateGoal(
  options?: UseMutationOptions<GoalEntity, Error, UpdateGoalVariables>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: UpdateGoalVariables) => app.tasks.updateGoal(id, input),
    ...withCacheOnSuccess(options, () => {
      void queryClient.invalidateQueries({ queryKey: tasksKeys.all });
    }),
  });
}

/** Its tasks lose their goal, so the board refetches too. */
export function useDeleteGoal(options?: UseMutationOptions<void, Error, string>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => app.tasks.removeGoal(id),
    ...withCacheOnSuccess(options, () => {
      void queryClient.invalidateQueries({ queryKey: tasksKeys.all });
    }),
  });
}
