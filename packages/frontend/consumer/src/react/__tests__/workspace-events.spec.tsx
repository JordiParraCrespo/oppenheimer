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
   * Once per gap. Going live the first time refetches nothing (the screens
   * just read), and a drop refetches nothing (the polls never stopped); only
   * the reconnect after a drop catches up, once.
   */
  it('catches up once after a reconnect, and not on the first connect or the drop', async () => {
    const { status, wrapper, invalidated } = setup();
    renderHook(() => useWorkspaceEvents('org-1'), { wrapper });

    await status('live');
    await status('down');
    expect(invalidated).toEqual([]);

    await status('live');
    expect(invalidated).toContainEqual(sessionsKeys.all);
    expect(invalidated).toContainEqual(automationsKeys.details());
    const once = invalidated.length;
    await status('live');
    expect(invalidated).toHaveLength(once);
  });

  it('closes the stream on unmount', () => {
    const { stream, wrapper } = setup();
    const { unmount } = renderHook(() => useWorkspaceEvents('org-1'), { wrapper });
    unmount();
    expect(stream.dispose).toHaveBeenCalled();
  });
});
