import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import { TaskEntity } from '../../modules/tasks/task.entity';
import type { TasksRepository } from '../../modules/tasks/tasks.repository';
import { tasksKeys } from '../tasks.keys';
import {
  useCreateTask,
  useDeleteTask,
  useMilestones,
  useMoveTask,
  useSessionTasks,
  useTasks,
  useUpdateTask,
} from '../tasks.queries';
import { fakeKernel } from './fake-kernel';

const at = new Date('2026-10-01T00:00:00Z');

function task(
  id: string,
  {
    status = 'todo',
    rank = id,
    milestoneId = null,
    title = id,
    sessionIds = [],
  }: {
    status?: TaskEntity['status'];
    rank?: string;
    milestoneId?: string | null;
    title?: string;
    sessionIds?: string[];
  } = {},
): TaskEntity {
  return new TaskEntity(
    id,
    'p-1',
    milestoneId,
    status,
    rank,
    title,
    '',
    null,
    null,
    status === 'done' ? at : null,
    sessionIds.map((sessionId) => ({ sessionId, origin: 'linked' as const, linkedAt: at })),
    at,
    at,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** The repository methods these hooks call, so a renamed one fails to compile here. */
type TasksFake = Partial<
  Pick<TasksRepository, 'findAll' | 'findMilestones' | 'create' | 'update' | 'move' | 'remove'>
>;

function setup(service: TasksFake) {
  const app = fakeKernel({ [TOKENS.TasksRepository]: service });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  return { wrapper, queryClient };
}

const columnOf = (rows: TaskEntity[] | undefined, id: string) =>
  rows?.find((row) => row.id === id)?.status;

describe('useMoveTask', () => {
  it('has the card in its new column in the same frame as the drop, even over a board read on its way', async () => {
    const stale = deferred<TaskEntity[]>();
    const findAll = vi
      .fn()
      .mockResolvedValueOnce([task('a'), task('b')])
      .mockReturnValueOnce(stale.promise);
    const { wrapper, queryClient } = setup({
      findAll,
      findMilestones: vi.fn().mockResolvedValue([]),
      move: vi.fn(() => new Promise<TaskEntity>(() => {})),
    });
    const { result } = renderHook(() => ({ tasks: useTasks(), move: useMoveTask() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));
    act(() => void queryClient.refetchQueries({ queryKey: tasksKeys.lists() }));
    await waitFor(() => expect(findAll).toHaveBeenCalledTimes(2));
    const board = () =>
      queryClient.getQueriesData<TaskEntity[]>({ queryKey: tasksKeys.lists() })[0]?.[1];

    // The board drops its live order in the same handler; a read that lags the drop puts the card back for a frame.
    let atDrop: string | undefined;
    act(() => {
      result.current.move.mutate({ id: 'a', status: 'doing', afterTaskId: null });
      atDrop = columnOf(board(), 'a');
    });
    await act(async () => stale.resolve([task('a'), task('b')]));

    expect(atDrop).toBe('doing');
    expect(columnOf(board(), 'a')).toBe('doing');
  });

  it('keeps a second drag where it was dropped while the first one settles', async () => {
    const board = [task('a'), task('b')];
    const findAll = vi.fn().mockResolvedValue(board);
    const answers = { a: deferred<TaskEntity>(), b: deferred<TaskEntity>() };
    const move = vi.fn((id: string) => answers[id as keyof typeof answers].promise);
    const { wrapper } = setup({ findAll, findMilestones: vi.fn().mockResolvedValue([]), move });
    const { result } = renderHook(() => ({ tasks: useTasks(), move: useMoveTask() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));

    act(() => result.current.move.mutate({ id: 'a', status: 'doing', afterTaskId: null }));
    act(() => result.current.move.mutate({ id: 'b', status: 'doing', afterTaskId: 'a' }));
    await waitFor(() => expect(columnOf(result.current.tasks.data, 'b')).toBe('doing'));

    await act(async () => answers.a.resolve(task('a', { status: 'doing', rank: 'm' })));

    await waitFor(() =>
      expect(result.current.tasks.data?.find((row) => row.id === 'a')?.rank).toBe('m'),
    );
    expect(columnOf(result.current.tasks.data, 'b')).toBe('doing');
    expect(findAll).toHaveBeenCalledTimes(1);
  });

  it('puts back only its own card when refused, keeping a write that settled meanwhile', async () => {
    const findAll = vi
      .fn()
      .mockResolvedValueOnce([task('a'), task('b')])
      .mockReturnValue(new Promise(() => {}));
    const refusal = deferred<TaskEntity>();
    const { wrapper } = setup({
      findAll,
      findMilestones: vi.fn().mockResolvedValue([]),
      move: vi.fn(() => refusal.promise),
      update: vi.fn().mockResolvedValue(task('b', { title: 'Renamed' })),
    });
    const { result } = renderHook(
      () => ({ tasks: useTasks(), move: useMoveTask(), update: useUpdateTask() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));

    act(() => result.current.move.mutate({ id: 'a', status: 'doing', afterTaskId: null }));
    await act(() => result.current.update.mutateAsync({ id: 'b', input: { title: 'Renamed' } }));
    await act(async () => refusal.reject(new Error('refused')));

    await waitFor(() => expect(result.current.move.isError).toBe(true));
    expect(columnOf(result.current.tasks.data, 'a')).toBe('todo');
    expect(result.current.tasks.data?.find((row) => row.id === 'b')?.title).toBe('Renamed');
    expect(findAll).toHaveBeenCalledTimes(2);
  });

  it('keeps its answer over a board read that was already on its way', async () => {
    const stale = deferred<TaskEntity[]>();
    const findAll = vi
      .fn()
      .mockResolvedValueOnce([task('a')])
      .mockReturnValueOnce(stale.promise);
    const { wrapper, queryClient } = setup({
      findAll,
      findMilestones: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(task('a', { title: 'Renamed' })),
    });
    const { result } = renderHook(() => ({ tasks: useTasks(), update: useUpdateTask() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));
    act(() => void queryClient.refetchQueries({ queryKey: tasksKeys.lists() }));
    await waitFor(() => expect(findAll).toHaveBeenCalledTimes(2));

    await act(() => result.current.update.mutateAsync({ id: 'a', input: { title: 'Renamed' } }));
    await act(async () => stale.resolve([task('a')]));

    await waitFor(() => expect(result.current.tasks.data?.[0]?.title).toBe('Renamed'));
  });

  it("reads the milestones again when a milestone's task turns Done", async () => {
    const findMilestones = vi.fn().mockResolvedValue([]);
    const { wrapper } = setup({
      findAll: vi.fn().mockResolvedValue([task('a', { milestoneId: 'g-1' })]),
      findMilestones,
      move: vi.fn().mockResolvedValue(task('a', { milestoneId: 'g-1', status: 'done' })),
    });
    const { result } = renderHook(
      () => ({ tasks: useTasks(), milestones: useMilestones(), move: useMoveTask() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.milestones.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));

    await act(() =>
      result.current.move.mutateAsync({ id: 'a', status: 'done', afterTaskId: null }),
    );

    await waitFor(() => expect(findMilestones).toHaveBeenCalledTimes(2));
  });
});

describe('the milestones', () => {
  it('are not read again for a write that moves no count', async () => {
    const findMilestones = vi.fn().mockResolvedValue([]);
    const { wrapper } = setup({
      findAll: vi.fn().mockResolvedValue([task('a', { milestoneId: 'g-1' })]),
      findMilestones,
      update: vi.fn().mockResolvedValue(task('a', { milestoneId: 'g-1', title: 'Renamed' })),
      create: vi.fn().mockResolvedValue(task('b')),
    });
    const { result } = renderHook(
      () => ({
        tasks: useTasks(),
        milestones: useMilestones(),
        update: useUpdateTask(),
        create: useCreateTask(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.milestones.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));

    await act(() => result.current.update.mutateAsync({ id: 'a', input: { title: 'Renamed' } }));
    await act(() => result.current.create.mutateAsync({ title: 'b' }));

    await waitFor(() =>
      expect(result.current.tasks.data?.map((row) => row.title)).toEqual(['Renamed', 'b']),
    );
    expect(findMilestones).toHaveBeenCalledTimes(1);
  });

  it('are read again when a task joins a milestone', async () => {
    const findMilestones = vi.fn().mockResolvedValue([]);
    const { wrapper } = setup({
      findAll: vi.fn().mockResolvedValue([task('a')]),
      findMilestones,
      update: vi.fn().mockResolvedValue(task('a', { milestoneId: 'g-1' })),
    });
    const { result } = renderHook(
      () => ({ tasks: useTasks(), milestones: useMilestones(), update: useUpdateTask() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.milestones.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));

    await act(() => result.current.update.mutateAsync({ id: 'a', input: { milestoneId: 'g-1' } }));

    await waitFor(() => expect(findMilestones).toHaveBeenCalledTimes(2));
  });
});

describe('useSessionTasks', () => {
  it("answers from the board, with no read of the session's own", async () => {
    const findAll = vi
      .fn()
      .mockResolvedValue([task('a', { sessionIds: ['s-1'] }), task('b', { sessionIds: ['s-2'] })]);
    const { wrapper } = setup({ findAll });
    const { result } = renderHook(() => ({ board: useTasks(), mine: useSessionTasks('s-1') }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.mine.data?.map((row) => row.id)).toEqual(['a']));
    expect(findAll).toHaveBeenCalledTimes(1);
    expect(findAll).not.toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: expect.anything() }),
    );
  });
});

describe('milestone progress', () => {
  async function settled(
    board: TaskEntity[],
    service: TasksFake,
    write: (hooks: {
      update: ReturnType<typeof useUpdateTask>;
      remove: ReturnType<typeof useDeleteTask>;
    }) => Promise<unknown>,
  ) {
    const findMilestones = vi.fn().mockResolvedValue([]);
    const { wrapper } = setup({
      findAll: vi.fn().mockResolvedValue(board),
      findMilestones,
      ...service,
    });
    const { result } = renderHook(
      () => ({
        tasks: useTasks(),
        milestones: useMilestones(),
        update: useUpdateTask(),
        remove: useDeleteTask(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.milestones.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));
    await act(() => write(result.current));
    return findMilestones;
  }

  it('is read again when a task leaves its milestone', async () => {
    const findMilestones = await settled(
      [task('a', { milestoneId: 'g-1' })],
      { update: vi.fn().mockResolvedValue(task('a')) },
      ({ update }) => update.mutateAsync({ id: 'a', input: { milestoneId: null } }),
    );

    await waitFor(() => expect(findMilestones).toHaveBeenCalledTimes(2));
  });

  it("is read again when a milestone's task is deleted", async () => {
    const findMilestones = await settled(
      [task('a', { milestoneId: 'g-1' })],
      { remove: vi.fn().mockResolvedValue(undefined) },
      ({ remove }) => remove.mutateAsync('a'),
    );

    await waitFor(() => expect(findMilestones).toHaveBeenCalledTimes(2));
  });

  it('is not read again when a task on no milestone is deleted', async () => {
    const findMilestones = await settled(
      [task('a')],
      { remove: vi.fn().mockResolvedValue(undefined) },
      ({ remove }) => remove.mutateAsync('a'),
    );

    expect(findMilestones).toHaveBeenCalledTimes(1);
  });
});
