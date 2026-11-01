'use client';

import { useQuery, useSuspenseQueries, withCacheOnSuccess } from '@oppenheimer/frontend-core/react';
import {
  type QueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  type MilestoneEntity,
  type MilestoneInput,
  TaskEntity,
  type TaskInput,
  type TaskMove,
} from '../modules/tasks/task.entity';
import type { StartedTaskSession, StartTaskSessionInput } from '../modules/tasks/tasks.repository';
import { useConsumerApp } from './context';
import { useHostListQuery, useHostPresencePoll } from './hosts.queries';
import { mutation } from './mutation';
import { useProjectListQuery } from './projects.queries';
import { sessionsKeys } from './sessions.keys';
import { useSessionListPoll, useSessionListQuery } from './sessions.queries';
import { tasksKeys } from './tasks.keys';

/**
 * Every task on the board, in board order. One read serves the columns, the
 * sidebar's counts and the rail's: pass `select` for less than the whole list.
 */
export function useTasks<TData = TaskEntity[]>(
  options?: Omit<UseQueryOptions<TaskEntity[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<TaskEntity[], Error, TData>({ ...useTaskListQuery(), ...options });
}

/**
 * Start session's three reads under a Suspense `QueryState`: the tasks, the
 * projects and the hosts with their presence, polled while the dialog is
 * open. They fetch side by side; `error` is the first refetch that failed
 * over data already drawn.
 */
export function useSuspenseStartSession() {
  const [tasks, projects, hosts] = useSuspenseQueries({
    queries: [
      useTaskListQuery(),
      useProjectListQuery(),
      { ...useHostListQuery(), ...useHostPresencePoll(true) },
    ],
  });
  return {
    tasks: tasks.data,
    projects: projects.data,
    hosts: hosts.data,
    error: tasks.error ?? projects.error ?? hosts.error,
  };
}

/** The tasks read, for both hooks over it: the key and the fetch, once. */
function useTaskListQuery() {
  const app = useConsumerApp();
  return { queryKey: tasksKeys.list(), queryFn: () => app.tasks.findAll() };
}

/** The tasks a session is on: the session header's "Back to task", derived from the board. */
export function useSessionTasks(sessionId: string | undefined) {
  return useTasks({
    select: (rows) =>
      rows.filter((row) => row.sessions.some((link) => link.sessionId === sessionId)),
    enabled: sessionId !== undefined,
  });
}

/** The milestones of the workspace, with their progress. */
export function useMilestones<TData = MilestoneEntity[]>(
  options?: Omit<UseQueryOptions<MilestoneEntity[], Error, TData>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<MilestoneEntity[], Error, TData>({ ...useMilestoneListQuery(), ...options });
}

/**
 * The task dialog's and the milestones timeline's three reads under a
 * Suspense `QueryState`: the tasks, the projects they are filed under and the
 * milestones, fetched side by side. `error` is the first refetch that failed
 * over data already drawn.
 */
export function useSuspensePlan() {
  const [tasks, projects, milestones] = useSuspenseQueries({
    queries: [useTaskListQuery(), useProjectListQuery(), useMilestoneListQuery()],
  });
  return {
    tasks: tasks.data,
    projects: projects.data,
    milestones: milestones.data,
    error: tasks.error ?? projects.error ?? milestones.error,
  };
}

/**
 * The board's reads under a Suspense `QueryState`: the tasks, and what a card
 * names beside its title — its project, its milestone, its session and that
 * session's host — fetched side by side. `error` is the first refetch that
 * failed over data already drawn.
 */
export function useSuspenseTaskBoard() {
  const [tasks, projects, milestones, sessions, hosts] = useSuspenseQueries({
    queries: [
      useTaskListQuery(),
      useProjectListQuery(),
      useMilestoneListQuery(),
      { ...useSessionListQuery(), ...useSessionListPoll() },
      useHostListQuery(),
    ],
  });
  return {
    tasks: tasks.data,
    projects: projects.data,
    milestones: milestones.data,
    sessions: sessions.data,
    hosts: hosts.data,
    error: tasks.error ?? projects.error ?? milestones.error ?? sessions.error ?? hosts.error,
  };
}

/** The milestones read, for every hook over it: the key and the fetch, once. */
function useMilestoneListQuery() {
  const app = useConsumerApp();
  return { queryKey: tasksKeys.milestoneList(), queryFn: () => app.tasks.findMilestones() };
}

/**
 * The server's answer replaces that task's row on the board, or removes it on a
 * delete; milestones refetch when a milestone's `doneCount` or `totalCount` can move.
 * `previous` is the row before the write: read from the board unless the caller
 * already drew a provisional one there. A board read already in flight is
 * cancelled first, so an answer from before the write cannot land on top of it.
 */
async function settleTask(
  queryClient: QueryClient,
  id: string,
  task: TaskEntity | null,
  previous = queryClient.getQueryData<TaskEntity[]>(tasksKeys.list())?.find((row) => row.id === id),
) {
  const boardKnown = queryClient.getQueryData(tasksKeys.list()) !== undefined;
  if (boardKnown) await queryClient.cancelQueries({ queryKey: tasksKeys.list(), exact: true });
  queryClient.setQueryData<TaskEntity[]>(tasksKeys.list(), (rows) => {
    if (!rows) return rows;
    const rest = rows.filter((row) => row.id !== id);
    return task ? [...rest, task] : rest;
  });
  if (!boardKnown || movesMilestoneProgress(previous, task)) {
    void queryClient.invalidateQueries({ queryKey: tasksKeys.milestones() });
  }
}

/** A task joined or left a milestone, or one on a milestone turned Done or back. */
function movesMilestoneProgress(was: TaskEntity | undefined, now: TaskEntity | null): boolean {
  const before = was?.milestoneId ?? null;
  const after = now?.milestoneId ?? null;
  if (before !== after) return true;
  return before !== null && (was?.isDone ?? false) !== (now?.isDone ?? false);
}

export const useCreateTask = mutation<TaskEntity, TaskInput>({
  run: (app, input) => app.tasks.create(input),
  update: (queryClient, task) => settleTask(queryClient, task.id, task),
});

export interface UpdateTaskVariables {
  id: string;
  input: Partial<TaskInput>;
}

export const useUpdateTask = mutation<TaskEntity, UpdateTaskVariables>({
  run: (app, { id, input }) => app.tasks.update(id, input),
  update: (queryClient, task) => settleTask(queryClient, task.id, task),
});

export interface MoveTaskVariables extends TaskMove {
  id: string;
}

/**
 * A drag or a tick. The card moves on the drop: the board is written at once with
 * a provisional key just after the task it landed below (or before every key, at
 * the top), and the server's key replaces it. A refusal puts that card back and
 * reads the board again, since other writes may have settled while it was out.
 */
export function useMoveTask(
  options?: UseMutationOptions<TaskEntity, Error, MoveTaskVariables, { previous?: TaskEntity }>,
) {
  const app = useConsumerApp();
  const queryClient = useQueryClient();
  return useMutation({
    ...withCacheOnSuccess(options, (task, _move, context) =>
      settleTask(queryClient, task.id, task, context?.previous),
    ),
    mutationFn: ({ id, status, afterTaskId }: MoveTaskVariables) =>
      app.tasks.move(id, { status, afterTaskId }),
    onMutate: async (move) => {
      // Written before anything is awaited: the board lets go of its drag order in the
      // drop's own handler, and a read that lands later shows the card back home for a
      // frame. Cancelling first reverts a read on its way now, so it cannot undo this.
      const cancelled = queryClient.cancelQueries({ queryKey: tasksKeys.list() });
      const rows = queryClient.getQueryData<TaskEntity[]>(tasksKeys.list());
      const previous = rows?.find((row) => row.id === move.id);
      queryClient.setQueryData<TaskEntity[]>(tasksKeys.list(), (current) =>
        current?.map((row) => (row.id === move.id ? provisionallyMoved(row, move, current) : row)),
      );
      await cancelled;
      return { previous };
    },
    onError: (error, move, context, mutation) => {
      const previous = context?.previous;
      if (previous) {
        queryClient.setQueryData<TaskEntity[]>(tasksKeys.list(), (rows) =>
          rows?.map((row) => (row.id === previous.id ? previous : row)),
        );
      }
      void queryClient.invalidateQueries({ queryKey: tasksKeys.list() });
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
    task.milestoneId,
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

export const useDeleteTask = mutation<void, string>({
  run: (app, id) => app.tasks.remove(id),
  update: (queryClient, _data, id) => settleTask(queryClient, id, null),
});

export type StartTaskSessionVariables = StartTaskSessionInput & { id: string };

/** Start a session for a task; the session list learns of it on its next read. */
export const useStartTaskSession = mutation<StartedTaskSession, StartTaskSessionVariables>({
  run: (app, variables) => app.tasks.startSession(variables.id, variables),
  update: (queryClient, started) => {
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    return settleTask(queryClient, started.task.id, started.task);
  },
});

export interface LinkTaskSessionVariables {
  id: string;
  sessionId: string;
  seenStatus: TaskEntity['status'];
}

export const useLinkTaskSession = mutation<TaskEntity, LinkTaskSessionVariables>({
  run: (app, { id, sessionId, seenStatus }) => app.tasks.linkSession(id, sessionId, seenStatus),
  update: (queryClient, task) => settleTask(queryClient, task.id, task),
});

export const useUnlinkTaskSession = mutation<TaskEntity, { id: string; sessionId: string }>({
  run: (app, { id, sessionId }) => app.tasks.unlinkSession(id, sessionId),
  update: (queryClient, task) => settleTask(queryClient, task.id, task),
});

export const useCreateMilestone = mutation<MilestoneEntity, MilestoneInput>({
  run: (app, input) => app.tasks.createMilestone(input),
  update: (queryClient) => {
    void queryClient.invalidateQueries({ queryKey: tasksKeys.milestones() });
  },
});

export interface UpdateMilestoneVariables {
  id: string;
  input: Partial<MilestoneInput>;
}

/** A milestone moved to another project takes its tasks with it, so the board refetches too. */
export const useUpdateMilestone = mutation<MilestoneEntity, UpdateMilestoneVariables>({
  run: (app, { id, input }) => app.tasks.updateMilestone(id, input),
  update: (queryClient) => {
    void queryClient.invalidateQueries({ queryKey: tasksKeys.all });
  },
});

/** Its tasks lose their milestone, so the board refetches too. */
export const useDeleteMilestone = mutation<void, string>({
  run: (app, id) => app.tasks.removeMilestone(id),
  update: (queryClient) => {
    void queryClient.invalidateQueries({ queryKey: tasksKeys.all });
  },
});
