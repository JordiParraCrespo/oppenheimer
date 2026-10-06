import { defaultQueryClientOptions, OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import { type Query, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import type { AutomationEntity, RunPage } from '../../modules/automations/automation.entity';
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
 * there yet; the list hands each row to its detail; and each write refreshes
 * what it changed, and only that, before the caller's own `onSuccess` runs.
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

function setup(
  service: Record<string, unknown>,
  // The console's own defaults, for the specs whose rule is its stale window.
  defaultOptions: ConstructorParameters<typeof QueryClient>[0] = {
    defaultOptions: { queries: { retry: false } },
  },
) {
  const app = fakeKernel({ [TOKENS.AutomationsRepository]: service });
  const queryClient = new QueryClient(defaultOptions);
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

describe('useAutomations and useAutomation', () => {
  it('opens an automation from the list without asking for it again', async () => {
    const findById = vi.fn();
    const { wrapper } = setup(
      { findAll: vi.fn().mockResolvedValue([automation('a-1'), automation('a-2')]), findById },
      { defaultOptions: defaultQueryClientOptions(60_000) },
    );
    const { result: list } = renderHook(() => useAutomations(), { wrapper });
    await waitFor(() => expect(list.current.isSuccess).toBe(true));

    const { result: detail } = renderHook(() => useAutomation('a-2'), { wrapper });

    expect(detail.current.data).toBe(list.current.data?.[1]);
    expect(findById).not.toHaveBeenCalled();
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
   * Seed a read from each branch of the tree: the list, a detail, a run page
   * and a trigger preview. Each write leaves stale what it changed, writes the
   * automation it was answered with into its detail, and leaves the rest alone.
   */
  const reads = {
    list: automationsKeys.list(),
    detail: automationsKeys.detail('a-1'),
    runs: automationsKeys.runList({ page: 1 }),
    preview: automationsKeys.preview(undefined),
  };
  type Read = keyof typeof reads;

  function seeded(queryClient: QueryClient) {
    for (const key of Object.values(reads)) queryClient.setQueryData(key, 'cached');
  }

  const written = automation('a-1');
  const cases: {
    name: string;
    method: string;
    hook: unknown;
    variables: unknown;
    called: unknown[];
    answer: unknown;
    stale: Read[];
  }[] = [
    {
      name: 'create',
      method: 'create',
      hook: useCreateAutomation,
      variables: { name: 'Nightly' },
      called: [{ name: 'Nightly' }],
      answer: written,
      stale: ['list'],
    },
    {
      name: 'update',
      method: 'update',
      hook: useUpdateAutomation,
      variables: { id: 'a-1', input: { name: 'Renamed' } },
      called: ['a-1', { name: 'Renamed' }],
      answer: written,
      // Every run row carries the automation's name.
      stale: ['list', 'runs'],
    },
    {
      name: 'pause',
      method: 'pause',
      hook: useSetAutomationPaused,
      variables: { id: 'a-1', paused: true },
      called: ['a-1'],
      answer: written,
      stale: ['list'],
    },
    {
      name: 'resume',
      method: 'resume',
      hook: useSetAutomationPaused,
      variables: { id: 'a-1', paused: false },
      called: ['a-1'],
      answer: written,
      stale: ['list'],
    },
    {
      name: 'duplicate',
      method: 'duplicate',
      hook: useDuplicateAutomation,
      variables: 'a-1',
      called: ['a-1'],
      answer: written,
      stale: ['list'],
    },
    {
      name: 'run now',
      method: 'run',
      hook: useRunAutomation,
      variables: { id: 'a-1', idempotencyKey: 'click-1' },
      called: ['a-1', 'click-1'],
      answer: { id: 'r-1' },
      stale: ['list', 'detail', 'runs'],
    },
  ];

  for (const { name, method, hook, variables, called, answer, stale } of cases) {
    it(`${name} leaves stale only what it changed, before the caller's onSuccess`, async () => {
      const service = { [method]: vi.fn().mockResolvedValue(answer) };
      const { wrapper, queryClient } = setup(service);
      seeded(queryClient);
      const onSuccess = vi.fn(() => ({
        stale: (Object.keys(reads) as Read[]).filter(
          (read) => queryClient.getQueryState(reads[read])?.isInvalidated,
        ),
        detail: queryClient.getQueryData(reads.detail),
      }));
      const useHook = hook as (options: { onSuccess: typeof onSuccess }) => {
        mutateAsync: (variables: unknown) => Promise<unknown>;
      };
      const { result } = renderHook(() => useHook({ onSuccess }), { wrapper });

      await act(() => result.current.mutateAsync(variables));

      expect(service[method]).toHaveBeenCalledWith(...called);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess.mock.calls[0]).toContain(variables);
      const seen = onSuccess.mock.results[0]?.value;
      expect(seen.stale).toEqual(stale);
      if (answer === written) expect(seen.detail).toBe(written);
    });
  }

  it("delete forgets the deleted automation, leaves the list and the runs stale, then runs the caller's onSuccess", async () => {
    const service = { remove: vi.fn().mockResolvedValue(undefined) };
    const { wrapper, queryClient } = setup(service);
    seeded(queryClient);
    const onSuccess = vi.fn(() => ({
      detail: queryClient.getQueryState(reads.detail),
      stale: [reads.list, reads.runs, reads.preview].map(
        (key) => queryClient.getQueryState(key)?.isInvalidated,
      ),
    }));
    const { result } = renderHook(() => useDeleteAutomation({ onSuccess }), { wrapper });

    await act(() => result.current.mutateAsync('a-1'));

    expect(service.remove).toHaveBeenCalledWith('a-1');
    expect(onSuccess.mock.results[0]?.value).toEqual({
      detail: undefined,
      stale: [true, true, false],
    });
  });
});
