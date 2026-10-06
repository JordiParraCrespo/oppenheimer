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

/** The tasks a session is on: the session header's "Back to task", derived from the board. */
export function useSessionTasks(sessionId: string | undefined) {
  return useTasks({
    select: (rows) =>
      rows.filter((row) => row.sessions.some((link) => link.sessionId === sessionId)),
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
 * The server's answer replaces that task's row on the board, or removes it on a
 * delete; goals refetch when a goal's `doneCount` or `totalCount` can move.
 * `previous` is the row before the write: read from the board unless the caller
 * already drew a provisional one there.
 */
function settleTask(
  queryClient: QueryClient,
  id: string,
  task: TaskEntity | null,
  previous = queryClient
    .getQueryData<TaskEntity[]>(tasksKeys.list(BOARD))
    ?.find((row) => row.id === id),
) {
  const boardKnown = queryClient.getQueryData(tasksKeys.list(BOARD)) !== undefined;
  queryClient.setQueryData<TaskEntity[]>(tasksKeys.list(BOARD), (rows) => {
    if (!rows) return rows;
    const rest = rows.filter((row) => row.id !== id);
    return task ? [...rest, task] : rest;
  });
  if (!boardKnown || movesGoalProgress(previous, task)) {
    void queryClient.invalidateQueries({ queryKey: tasksKeys.goals() });
  }
}

/** A task joined or left a goal, or one on a goal turned Done or back. */
function movesGoalProgress(was: TaskEntity | undefined, now: TaskEntity | null): boolean {
  const before = was?.goalId ?? null;
  const after = now?.goalId ?? null;
  if (before !== after) return true;
  return before !== null && (was?.isDone ?? false) !== (now?.isDone ?? false);
}

export function useCreateTask(options?: UseMutationOptions<TaskEntity, Error, TaskInput>) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) => app.tasks.create(input),
    ...withCacheOnSuccess(options, (task) => settleTask(queryClient, task.id, task)),
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
    ...withCacheOnSuccess(options, (task) => settleTask(queryClient, task.id, task)),
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
    ...withCacheOnSuccess(options, (task, move, context) =>
      settleTask(
        queryClient,
        task.id,
        task,
        context?.previous?.find((row) => row.id === move.id),
      ),
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
    ...withCacheOnSuccess(options, (_data, id) => settleTask(queryClient, id, null)),
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
      settleTask(queryClient, started.task.id, started.task);
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
    ...withCacheOnSuccess(options, (task) => settleTask(queryClient, task.id, task)),
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
    ...withCacheOnSuccess(options, (task) => settleTask(queryClient, task.id, task)),
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
