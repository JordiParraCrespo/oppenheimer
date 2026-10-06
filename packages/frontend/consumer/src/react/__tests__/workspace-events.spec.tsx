import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import type { WorkspaceEvent } from '@oppenheimer/shared/workspace-events';
import { type Query, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import type { WorkspaceStreamStatus } from '../../modules/organizations';
import type { SessionEntity } from '../../modules/sessions/session.entity';
import { automationsKeys } from '../automations.queries';
import { hostsKeys } from '../hosts.queries';
import { LIVE_POLL } from '../live-poll';
import { sessionsKeys, useSessions } from '../sessions.queries';
import { useWorkspaceEvents } from '../workspace-events';
import { fakeKernel } from './fake-kernel';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('@oppenheimer/frontend-core/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@oppenheimer/frontend-core/react')>()),
  useFeatureFlag: () => flag.on,
}));

/** A stream the spec drives by hand: what the API would send, when it would. */
function fakeStream() {
  let status: (status: WorkspaceStreamStatus) => void = () => {};
  let event: (event: WorkspaceEvent) => void = () => {};
  const stream = {
    onStatus: (listener: typeof status) => {
      status = listener;
      listener('down');
      return () => {};
    },
    onEvent: (listener: typeof event) => {
      event = listener;
      return () => {};
    },
    dispose: vi.fn(),
  };
  return {
    stream,
    status: (next: WorkspaceStreamStatus) => act(() => status(next)),
    send: (next: WorkspaceEvent) => act(() => event(next)),
  };
}

function setup(sessions: Record<string, unknown> = {}) {
  const fake = fakeStream();
  const openEvents = vi.fn(() => fake.stream);
  const app = fakeKernel({
    [TOKENS.OrganizationsService]: { openEvents },
    [TOKENS.SessionsService]: sessions,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidated: unknown[][] = [];
  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(async (filters) => {
    invalidated.push([...(filters?.queryKey ?? [])]);
  });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }
  return { ...fake, openEvents, wrapper, invalidated, queryClient };
}

/** The interval the query would poll at for the data it holds now. */
function pollInterval(queryClient: QueryClient, queryKey: readonly unknown[]) {
  const query = queryClient.getQueryCache().find({ queryKey, exact: true }) as Query;
  const interval = query.observers[0]?.options.refetchInterval;
  return typeof interval === 'function' ? interval(query) : interval;
}

afterEach(() => {
  flag.on = true;
});

describe('useWorkspaceEvents', () => {
  it('opens nothing while the flag is off or there is no workspace', () => {
    flag.on = false;
    const off = setup();
    renderHook(() => useWorkspaceEvents('org-1'), { wrapper: off.wrapper });
    expect(off.openEvents).not.toHaveBeenCalled();

    flag.on = true;
    const none = setup();
    renderHook(() => useWorkspaceEvents(undefined), { wrapper: none.wrapper });
    expect(none.openEvents).not.toHaveBeenCalled();
  });

  it('refetches the reads an event names, and never mints a pairing token', async () => {
    const { status, send, wrapper, invalidated } = setup();
    renderHook(() => useWorkspaceEvents('org-1'), { wrapper });
    await status('live');
    invalidated.length = 0;

    await send({ type: 'session.changed', id: 's-1' });
    expect(invalidated).toEqual([
      sessionsKeys.detail('s-1'),
      sessionsKeys.lists(),
      hostsKeys.lists(),
    ]);

    invalidated.length = 0;
    await send({ type: 'pairing.spent', id: 'p-1', hostId: 'h-1' });
    expect(invalidated).toEqual([hostsKeys.pairingLists(), hostsKeys.lists()]);
    expect(invalidated).not.toContainEqual(hostsKeys.pairings());

    invalidated.length = 0;
    await send({ type: 'automationRun.changed', id: 'r-1', automationId: 'a-1' });
    expect(invalidated).toEqual([
      automationsKeys.lists(),
      automationsKeys.runs(),
      automationsKeys.detail('a-1'),
    ]);
  });

  /**
   * Once per gap, the first connect included: the polls stand down on `ready`,
   * so a change that landed between a screen's read and the subscription would
   * otherwise never be read. A drop refetches nothing; the polls are back.
   */
  it('catches up once each time it comes up, the first connect included, and not on the drop', async () => {
    const { status, wrapper, invalidated } = setup();
    renderHook(() => useWorkspaceEvents('org-1'), { wrapper });

    await status('live');
    expect(invalidated).toContainEqual(sessionsKeys.all);
    expect(invalidated).toContainEqual(automationsKeys.details());
    const once = invalidated.length;

    await status('down');
    expect(invalidated).toHaveLength(once);

    await status('live');
    expect(invalidated).toHaveLength(once * 2);
  });

  it('stands the session list poll down while live, and gives it back when the stream drops', async () => {
    const starting = { id: 's-1', isProvisioning: true } as SessionEntity;
    const { status, wrapper, queryClient } = setup({
      findAll: vi.fn().mockResolvedValue([starting]),
    });
    const { result } = renderHook(
      () => {
        useWorkspaceEvents('org-1');
        return useSessions();
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pollInterval(queryClient, sessionsKeys.list())).toBe(LIVE_POLL.sessionStarting.interval);

    await status('live');
    await waitFor(() => expect(pollInterval(queryClient, sessionsKeys.list())).toBe(false));

    await status('down');
    await waitFor(() =>
      expect(pollInterval(queryClient, sessionsKeys.list())).toBe(
        LIVE_POLL.sessionStarting.interval,
      ),
    );
  });

  it('closes the stream on unmount', () => {
    const { stream, wrapper } = setup();
    const { unmount } = renderHook(() => useWorkspaceEvents('org-1'), { wrapper });
    unmount();
    expect(stream.dispose).toHaveBeenCalled();
  });
});
