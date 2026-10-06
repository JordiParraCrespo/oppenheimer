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
 * `automationsKeys.all`; the list, a detail and a run page read again only
 * while something is running; nothing is asked for an id or a trigger that is
 * not there yet; the list hands each row to its detail; and each write
 * refreshes what it changed, and only that, before the caller's own
 * `onSuccess` runs.
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
  /** The reads a write may touch: the source's list row and detail, a run page, a preview. */
  const reads = {
    list: automationsKeys.list(),
    detail: automationsKeys.detail('a-1'),
    runs: automationsKeys.runList({ page: 1 }),
    preview: automationsKeys.preview(undefined),
  };
  type Read = keyof typeof reads;

  const source = automation('a-1');
  const saved = automation('a-1', true);
  const copy = automation('a-2');

  interface WriteCase {
    name: string;
    service: Record<string, unknown>;
    write: (hooks: ReturnType<typeof useWrites>) => Promise<unknown>;
    stale: Read[];
    /** Where the answer must land, if the answer is an automation. */
    lands?: { detail: string; listRow: boolean };
    /** Whether the source's detail is gone afterwards. */
    removed?: boolean;
  }

  function useWrites() {
    return {
      create: useCreateAutomation(),
      update: useUpdateAutomation(),
      paused: useSetAutomationPaused(),
      duplicate: useDuplicateAutomation(),
      remove: useDeleteAutomation(),
      run: useRunAutomation(),
    };
  }

  const cases: WriteCase[] = [
    {
      name: 'create',
      service: { create: vi.fn().mockResolvedValue(copy) },
      write: ({ create }) => create.mutateAsync({ name: 'Nightly' } as never),
      stale: ['list'],
      lands: { detail: 'a-2', listRow: false },
    },
    {
      name: 'duplicate',
      service: { duplicate: vi.fn().mockResolvedValue(copy) },
      write: ({ duplicate }) => duplicate.mutateAsync('a-1'),
      stale: ['list'],
      lands: { detail: 'a-2', listRow: false },
    },
    {
      name: 'update',
      service: { update: vi.fn().mockResolvedValue(saved) },
      write: ({ update }) => update.mutateAsync({ id: 'a-1', input: { version: 1 } }),
      // Every run row carries the automation's name.
      stale: ['runs'],
      lands: { detail: 'a-1', listRow: true },
    },
    {
      name: 'pause',
      service: { pause: vi.fn().mockResolvedValue(saved) },
      write: ({ paused }) => paused.mutateAsync({ id: 'a-1', paused: true }),
      stale: [],
      lands: { detail: 'a-1', listRow: true },
    },
    {
      name: 'resume',
      service: { resume: vi.fn().mockResolvedValue(saved) },
      write: ({ paused }) => paused.mutateAsync({ id: 'a-1', paused: false }),
      stale: [],
      lands: { detail: 'a-1', listRow: true },
    },
    {
      name: 'run now',
      service: { run: vi.fn().mockResolvedValue({ id: 'r-1' }) },
      write: ({ run }) => run.mutateAsync({ id: 'a-1', idempotencyKey: 'click-1' }),
      stale: ['list', 'detail', 'runs'],
    },
    {
      name: 'delete',
      service: { remove: vi.fn().mockResolvedValue(undefined) },
      write: ({ remove }) => remove.mutateAsync('a-1'),
      stale: ['list', 'runs'],
      removed: true,
    },
  ];

  for (const { name, service, write, stale, lands, removed } of cases) {
    it(`${name} refreshes what it changed, and only that`, async () => {
      const { wrapper, queryClient } = setup(service);
      queryClient.setQueryData(reads.list, [source]);
      queryClient.setQueryData(reads.detail, source);
      queryClient.setQueryData(reads.runs, 'cached');
      queryClient.setQueryData(reads.preview, 'cached');
      const { result } = renderHook(() => useWrites(), { wrapper });

      await act(() => write(result.current));

      const isStale = (read: Read) => queryClient.getQueryState(reads[read])?.isInvalidated;
      expect((Object.keys(reads) as Read[]).filter(isStale)).toEqual(stale);
      if (lands) {
        const answer = lands.listRow ? saved : copy;
        expect(queryClient.getQueryData(automationsKeys.detail(lands.detail))).toBe(answer);
        expect(queryClient.getQueryData<AutomationEntity[]>(reads.list)?.[0]).toBe(
          lands.listRow ? answer : source,
        );
        if (!lands.listRow) expect(queryClient.getQueryData(reads.detail)).toBe(source);
      }
      if (removed) expect(queryClient.getQueryState(reads.detail)).toBeUndefined();
    });
  }

  it("runs the caller's onSuccess after its own refresh", async () => {
    const { wrapper, queryClient } = setup({ pause: vi.fn().mockResolvedValue(saved) });
    queryClient.setQueryData(reads.detail, source);
    const onSuccess = vi.fn(() => queryClient.getQueryData(reads.detail));
    const { result } = renderHook(() => useSetAutomationPaused({ onSuccess }), { wrapper });

    await act(() => result.current.mutateAsync({ id: 'a-1', paused: true }));

    expect(onSuccess.mock.results[0]?.value).toBe(saved);
  });

  it('keeps a pause it settled over a detail read that was already on its way', async () => {
    let answerStale!: (value: AutomationEntity) => void;
    const findById = vi
      .fn()
      .mockResolvedValueOnce(source)
      .mockReturnValueOnce(
        new Promise<AutomationEntity>((resolve) => {
          answerStale = resolve;
        }),
      );
    const { wrapper, queryClient } = setup({ findById, pause: vi.fn().mockResolvedValue(saved) });
    const { result } = renderHook(
      () => ({ detail: useAutomation('a-1'), paused: useSetAutomationPaused() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));
    act(() => void queryClient.refetchQueries({ queryKey: reads.detail }));
    await waitFor(() => expect(findById).toHaveBeenCalledTimes(2));

    await act(() => result.current.paused.mutateAsync({ id: 'a-1', paused: true }));
    await act(async () => answerStale(source));

    await waitFor(() => expect(result.current.detail.data).toBe(saved));
  });
});
