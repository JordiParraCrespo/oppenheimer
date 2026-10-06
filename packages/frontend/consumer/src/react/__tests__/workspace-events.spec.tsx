import { OppenheimerProvider } from '@oppenheimer/frontend-core/react';
import type { WorkspaceEvent } from '@oppenheimer/shared/workspace-events';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import type { WorkspaceStreamStatus } from '../../modules/organizations';
import { automationsKeys } from '../automations.queries';
import { hostsKeys } from '../hosts.queries';
import { LIVE_POLL, pollWhile } from '../live-poll';
import { sessionsKeys } from '../sessions.queries';
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

function setup() {
  const fake = fakeStream();
  const openEvents = vi.fn(() => fake.stream);
  const app = fakeKernel({ [TOKENS.OrganizationsService]: { openEvents } });
  const queryClient = new QueryClient();
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
  return { ...fake, openEvents, wrapper, invalidated };
}

const presenceTick = () =>
  pollWhile('hostPresence', true).refetchInterval({ queryHash: 'hosts', state: {} });

afterEach(() => {
  flag.on = true;
});

describe('useWorkspaceEvents', () => {
  it('opens nothing while the flag is off, and the polls keep asking', () => {
    flag.on = false;
    const { openEvents, wrapper } = setup();
    renderHook(() => useWorkspaceEvents(), { wrapper });
    expect(openEvents).not.toHaveBeenCalled();
    expect(presenceTick()).toBe(LIVE_POLL.hostPresence.interval);
  });

  /**
   * The whole point, and both halves of it: while the stream is live no poll
   * asks, and the moment it drops every poll is back, with one refetch to
   * cover what the gap may have missed.
   */
  it('stands the polls down while live and brings them back when it drops', async () => {
    const { status, wrapper, invalidated } = setup();
    renderHook(() => useWorkspaceEvents(), { wrapper });

    await status('live');
    expect(presenceTick()).toBe(false);
    expect(invalidated).toContainEqual(sessionsKeys.all);
    expect(invalidated).toContainEqual(hostsKeys.pairingLists());

    invalidated.length = 0;
    await status('down');
    expect(presenceTick()).toBe(LIVE_POLL.hostPresence.interval);
    expect(invalidated).toContainEqual(hostsKeys.lists());
  });

  it('refetches the reads an event names, and never mints a pairing token', async () => {
    const { status, send, wrapper, invalidated } = setup();
    renderHook(() => useWorkspaceEvents(), { wrapper });
    await status('live');
    invalidated.length = 0;

    await send({ type: 'session.changed', id: 's-1' });
    expect(invalidated).toEqual([sessionsKeys.detail('s-1'), sessionsKeys.lists()]);

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

  it('closes the stream on unmount and leaves the polls asking', async () => {
    const { stream, status, wrapper } = setup();
    const { unmount } = renderHook(() => useWorkspaceEvents(), { wrapper });
    await status('live');
    unmount();
    expect(stream.dispose).toHaveBeenCalled();
    expect(presenceTick()).toBe(LIVE_POLL.hostPresence.interval);
  });
});
