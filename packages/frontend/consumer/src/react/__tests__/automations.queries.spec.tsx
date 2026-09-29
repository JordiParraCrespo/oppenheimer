import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { type Query, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import type {
  AutomationEntity,
  AutomationRunEntity,
  RunPage,
} from '../../modules/automations/automation.entity';
import {
  automationsKeys,
  useAutomation,
  useAutomationRuns,
  useAutomations,
  useCreateAutomation,
  useDeleteAutomation,
  useDuplicateAutomation,
  useRunAutomation,
  useSetAutomationPaused,
  useTriggerPreview,
  useUpdateAutomation,
} from '../automations.queries';
import { LIVE_POLL } from '../live-poll';
import { fakeKernel } from './fake-kernel';

/**
 * The automations hooks. What matters: every key lives under
 * `automationsKeys.all`, because every write can change the runs as well as the
 * automation; the list, a detail and a run page read again only while
 * something is running; nothing is asked for an id or a trigger that is not
 * there yet; and each write refreshes the whole subtree before the caller's
 * own `onSuccess` runs.
 */

// Real class instances: shareEntities compares them field by field, and a
// plain literal would pass on the default sharing alone.
class Automation {
  constructor(
    public readonly id: string,
    public readonly isRunning: boolean,
  ) {}
}
class Run {
  constructor(
    public readonly id: string,
    public readonly isLive: boolean,
  ) {}
}

const automation = (id: string, isRunning = false) =>
  new Automation(id, isRunning) as unknown as AutomationEntity;
const page = (...runs: Run[]) =>
  ({ items: runs, total: runs.length, page: 1, limit: 20, counts: {} }) as unknown as RunPage;

function setup(service: Record<string, unknown>) {
  const app = fakeKernel({ [TOKENS.AutomationsRepository]: service });
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

/** The interval the query would poll at for the data it holds now. */
function pollInterval(queryClient: QueryClient, queryKey: readonly unknown[]) {
  const query = queryClient.getQueryCache().find({ queryKey, exact: true }) as Query;
  const interval = query.observers[0]?.options.refetchInterval;
  return typeof interval === 'function' ? interval(query) : interval;
}

describe('automationsKeys', () => {
  it('puts every read under the root, so one invalidation reaches them all', async () => {
    const keys = [
      automationsKeys.list(),
      automationsKeys.detail('a-1'),
      automationsKeys.runList({ page: 2 }),
      automationsKeys.history({ timezone: 'UTC' }),
      automationsKeys.preview({ source: 'github' } as never),
    ];
    const client = new QueryClient();
    for (const key of keys) {
      expect(key.slice(0, 1)).toEqual(automationsKeys.all);
      client.setQueryData(key, 'cached');
    }

    await client.invalidateQueries({ queryKey: automationsKeys.all });

    for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  });

  it('keeps run pages and the history apart under runs, so a page is its filter', () => {
    expect(automationsKeys.runList({ page: 1 })).not.toEqual(automationsKeys.runList({ page: 2 }));
    expect(automationsKeys.runList({}).slice(0, 2)).toEqual(automationsKeys.runs());
    expect(automationsKeys.history({ timezone: 'UTC' }).slice(0, 2)).toEqual(
      automationsKeys.runs(),
    );
  });
});

describe('useAutomations', () => {
  it('polls while any automation is running, and not once none is', async () => {
    const findAll = vi.fn().mockResolvedValue([automation('a-1'), automation('a-2', true)]);
    const { wrapper, queryClient } = setup({ findAll });
    const { result } = renderHook(() => useAutomations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(pollInterval(queryClient, automationsKeys.list())).toBe(LIVE_POLL.liveRun.interval);

    queryClient.setQueryData(automationsKeys.list(), [automation('a-1'), automation('a-2')]);
    expect(pollInterval(queryClient, automationsKeys.list())).toBe(false);
  });

  it('keeps the rows of a refetch that changed nothing', async () => {
    const findAll = vi
      .fn()
      .mockResolvedValueOnce([automation('a-1'), automation('a-2')])
      .mockResolvedValue([automation('a-1'), automation('a-2', true)]);
    const { wrapper, queryClient } = setup({ findAll });
    const { result } = renderHook(() => useAutomations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data;

    await act(() => queryClient.refetchQueries({ queryKey: automationsKeys.list() }));

    expect(findAll).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.data).not.toBe(first));
    expect(result.current.data?.[0]).toBe(first?.[0]);
    expect(result.current.data?.[1]).not.toBe(first?.[1]);
  });
});

describe('useAutomation', () => {
  it('asks for nothing until there is an id', async () => {
    const findById = vi.fn().mockResolvedValue(automation('a-1'));
    const { wrapper } = setup({ findById });
    const { result, rerender } = renderHook(({ id }) => useAutomation(id), {
      wrapper,
      initialProps: { id: undefined as string | undefined },
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(findById).not.toHaveBeenCalled();

    rerender({ id: 'a-1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(findById).toHaveBeenCalledWith('a-1');
  });

  it('polls only while the automation is running', async () => {
    const findById = vi.fn().mockResolvedValue(automation('a-1', true));
    const { wrapper, queryClient } = setup({ findById });
    const { result } = renderHook(() => useAutomation('a-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(pollInterval(queryClient, automationsKeys.detail('a-1'))).toBe(
      LIVE_POLL.liveRun.interval,
    );

    queryClient.setQueryData(automationsKeys.detail('a-1'), automation('a-1'));
    expect(pollInterval(queryClient, automationsKeys.detail('a-1'))).toBe(false);
  });
});

describe('useAutomationRuns', () => {
  it('polls while a run on the page is queued or running', async () => {
    const findRuns = vi.fn().mockResolvedValue(page(new Run('r-1', false), new Run('r-2', true)));
    const { wrapper, queryClient } = setup({ findRuns });
    const { result } = renderHook(() => useAutomationRuns({ page: 1 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const key = automationsKeys.runList({ page: 1 });
    expect(pollInterval(queryClient, key)).toBe(LIVE_POLL.liveRun.interval);

    queryClient.setQueryData(key, page(new Run('r-1', false)));
    expect(pollInterval(queryClient, key)).toBe(false);
  });

  it('keeps the previous page on screen while the next one loads', async () => {
    let answerNext: (value: RunPage) => void = () => {};
    const firstPage = page(new Run('r-1', false));
    const findRuns = vi
      .fn()
      .mockResolvedValueOnce(firstPage)
      .mockImplementationOnce(
        () =>
          new Promise<RunPage>((resolve) => {
            answerNext = resolve;
          }),
      );
    const { wrapper } = setup({ findRuns });
    const { result, rerender } = renderHook(({ n }) => useAutomationRuns({ page: n }), {
      wrapper,
      initialProps: { n: 1 },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ n: 2 });
    await waitFor(() => expect(findRuns).toHaveBeenCalledTimes(2));
    expect(result.current.data?.items[0]?.id).toBe('r-1');
    expect(result.current.isPlaceholderData).toBe(true);

    act(() => answerNext(page(new Run('r-9', false))));
    await waitFor(() => expect(result.current.data?.items[0]?.id).toBe('r-9'));
    expect(result.current.isPlaceholderData).toBe(false);
  });
});

describe('useTriggerPreview', () => {
  it('asks for nothing while the trigger card is incomplete', () => {
    const previewTrigger = vi.fn();
    const { wrapper } = setup({ previewTrigger });
    const { result } = renderHook(() => useTriggerPreview(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(previewTrigger).not.toHaveBeenCalled();
  });
});

describe('automation writes', () => {
  /**
   * Seed a read from each branch of the tree: the list, a detail, a run page.
   * A write must leave every one of them stale.
   */
  function seeded(queryClient: QueryClient) {
    const keys = [
      automationsKeys.list(),
      automationsKeys.detail('a-1'),
      automationsKeys.runList({ page: 1 }),
    ];
    for (const key of keys) queryClient.setQueryData(key, 'cached');
    return keys;
  }

  const cases = [
    {
      name: 'create',
      method: 'create',
      hook: useCreateAutomation,
      variables: { name: 'Nightly' },
      called: [{ name: 'Nightly' }],
    },
    {
      name: 'update',
      method: 'update',
      hook: useUpdateAutomation,
      variables: { id: 'a-1', input: { name: 'Renamed' } },
      called: ['a-1', { name: 'Renamed' }],
    },
    {
      name: 'pause',
      method: 'pause',
      hook: useSetAutomationPaused,
      variables: { id: 'a-1', paused: true },
      called: ['a-1'],
    },
    {
      name: 'resume',
      method: 'resume',
      hook: useSetAutomationPaused,
      variables: { id: 'a-1', paused: false },
      called: ['a-1'],
    },
    {
      name: 'duplicate',
      method: 'duplicate',
      hook: useDuplicateAutomation,
      variables: 'a-1',
      called: ['a-1'],
    },
    {
      name: 'delete',
      method: 'remove',
      hook: useDeleteAutomation,
      variables: 'a-1',
      called: ['a-1'],
    },
    {
      name: 'run now',
      method: 'run',
      hook: useRunAutomation,
      variables: { id: 'a-1', idempotencyKey: 'click-1' },
      called: ['a-1', 'click-1'],
    },
  ] as const;

  for (const { name, method, hook, variables, called } of cases) {
    it(`${name} calls the repository, leaves every automations read stale, then runs the caller's onSuccess`, async () => {
      const answer = { id: 'a-1' } as unknown as AutomationRunEntity;
      const service = { [method]: vi.fn().mockResolvedValue(answer) };
      const { wrapper, queryClient } = setup(service);
      const keys = seeded(queryClient);
      const staleWhenCalled: boolean[] = [];
      const onSuccess = vi.fn(() => {
        for (const key of keys) {
          staleWhenCalled.push(queryClient.getQueryState(key)?.isInvalidated ?? false);
        }
      });
      const useHook = hook as unknown as (options: { onSuccess: typeof onSuccess }) => {
        mutateAsync: (variables: unknown) => Promise<unknown>;
      };
      const { result } = renderHook(() => useHook({ onSuccess }), { wrapper });

      await act(() => result.current.mutateAsync(variables));

      expect(service[method]).toHaveBeenCalledWith(...called);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess.mock.calls[0]).toContain(variables);
      expect(staleWhenCalled).toEqual(keys.map(() => true));
    });
  }

  it('resuming never pauses, and pausing never resumes', async () => {
    const service = { pause: vi.fn().mockResolvedValue({}), resume: vi.fn().mockResolvedValue({}) };
    const { wrapper } = setup(service);
    const { result } = renderHook(() => useSetAutomationPaused(), { wrapper });

    await act(() => result.current.mutateAsync({ id: 'a-1', paused: false }));

    expect(service.resume).toHaveBeenCalledWith('a-1');
    expect(service.pause).not.toHaveBeenCalled();
  });
});
