import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionPane } from '../sections/session-pane';
import { SharedSessionPane } from '../sections/shared-session-pane';

/**
 * Opening a stopped session brings it back: its owner navigates to it and the
 * pane restarts it, drawing Restarting while the host brings the terminal
 * back. Nothing short of opening it does: a row in a list, a pointer resting
 * on its link (the router preloads on intent), or a guest's view of a share.
 * A session that cannot come back (deleted, its host offline) keeps the
 * stopped pane, and a restart that fails, or that the host never answers,
 * falls back to it with Restart and the reason.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@oppenheimer/frontend-core/react', () => ({
  useFeatureFlag: () => false,
  useDeploymentCapabilities: () => ({ data: undefined }),
  useErrorMessage: () => (error: unknown, fallback: string) => ({
    message: error instanceof Error && error.message ? error.message : fallback,
  }),
  shareEntities: (data: unknown) => data,
}));

vi.mock('../hooks/use-session-chat', () => ({
  useSessionChat: () => ({}),
  useChatReading: () => ({ offered: false }),
}));

type Session = Record<string, unknown>;

let session: Session;
let hostOnline: boolean | undefined;
let restartResult: {
  isPending: boolean;
  isSuccess: boolean;
  error: unknown;
  submittedAt: number;
};
const mutate = vi.fn();

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  RESTART_WATCH_MS: 60_000,
  useSuspenseSession: () => ({ data: session, error: null }),
  useSessionOpening: () => false,
  useAcknowledgeSessionReport: () => ({ mutate: () => {} }),
  useRestartSession: () => ({ mutate, ...restartResult }),
  useHostPresence: ({ enabled }: { enabled: boolean }) => ({
    data: enabled ? hostOnline : undefined,
    isError: false,
  }),
  useSuspenseSharedSession: () => ({
    data: { name: 'Fix the list', state: 'stopped', expiresAt: null, access: 'read' },
    error: null,
    refetch: () => {},
  }),
}));

function stoppedSession(overrides: Session = {}): Session {
  return {
    id: 's-1',
    name: 'Fix the list',
    agent: 'claude-code',
    hostId: 'h-1',
    lifecycle: 'open',
    stoppedAt: new Date('2026-11-24T08:00:00Z'),
    isLive: false,
    isResolved: false,
    isProvisioning: false,
    isFolder: false,
    cloud: null,
    isCloud: false,
    cloudSessionId: null,
    state: 'stopped',
    lastEventAt: null,
    cwdCheckout: { branch: 'fix-the-list' },
    launch: {},
    ...overrides,
  };
}

/** The console in small: a list of sessions linking to each, and the session's page. */
function mountConsole(path: string) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const list = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => (
      <Link to="/sessions/$sessionId" params={{ sessionId: 's-1' }}>
        Fix the list
      </Link>
    ),
  });
  const pane = createRoute({
    getParentRoute: () => root,
    path: '/sessions/$sessionId',
    component: () => <SessionPane sessionId="s-1" terminal={() => <p>terminal</p>} />,
  });
  const fresh = createRoute({ getParentRoute: () => root, path: '/sessions/new' });
  const router = createRouter({
    routeTree: root.addChildren([list, pane, fresh]),
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPreload: 'intent',
    defaultPreloadDelay: 0,
  });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  session = stoppedSession();
  hostOnline = true;
  restartResult = { isPending: false, isSuccess: false, error: null, submittedAt: 0 };
  mutate.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('a stopped session opened by its owner', () => {
  it('restarts on open and reads Restarting while it comes back', async () => {
    mountConsole('/sessions/s-1');
    expect(await screen.findByText('sessions.closed.restarting')).toBeTruthy();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith('s-1');
  });

  it('is not woken by its row, a pointer resting on its link or the preload that starts', async () => {
    const router = mountConsole('/');
    const link = await screen.findByText('Fix the list');
    fireEvent.mouseEnter(link);
    fireEvent.focus(link);
    await act(async () => {
      await router.preloadRoute({ to: '/sessions/$sessionId', params: { sessionId: 's-1' } });
    });
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.click(link);
    await screen.findByText('sessions.closed.restarting');
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('keeps the stopped pane when its host is offline', async () => {
    hostOnline = false;
    mountConsole('/sessions/s-1');
    expect(await screen.findByText('sessions.closed.restart')).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('does not restart a deleted session', async () => {
    session = stoppedSession({ lifecycle: 'resolved', isResolved: true });
    mountConsole('/sessions/s-1');
    expect(await screen.findByText('sessions.closed.deleted')).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('falls back to the stopped pane, with Restart and the reason, when the restart fails', async () => {
    restartResult = {
      isPending: false,
      isSuccess: false,
      error: new Error('host refused'),
      submittedAt: Date.now(),
    };
    mountConsole('/sessions/s-1');
    expect(await screen.findByText('host refused')).toBeTruthy();
    expect(screen.getByText('sessions.closed.restart')).toBeTruthy();
  });

  it('falls back to the stopped pane when the host never brings the terminal back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    restartResult = { isPending: false, isSuccess: true, error: null, submittedAt: Date.now() };
    mountConsole('/sessions/s-1');
    expect(await screen.findByText('sessions.closed.restarting')).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('sessions.closed.restartFailed')).toBeTruthy();
    expect(screen.getByText('sessions.closed.restart')).toBeTruthy();
  });
});

describe('a session stopped again after it came back', () => {
  it('reads stopped, not Restarting', async () => {
    // The restart this pane asked for answered an hour-old stop; this one is newer.
    restartResult = {
      isPending: false,
      isSuccess: true,
      error: null,
      submittedAt: Date.now() - 60_000,
    };
    session = stoppedSession({ stoppedAt: new Date() });
    mountConsole('/sessions/s-1');
    expect(await screen.findByText('sessions.closed.restart')).toBeTruthy();
    expect(screen.queryByText('sessions.closed.restarting')).toBeNull();
  });
});

describe('a stopped session a guest opens from a share', () => {
  it('keeps the guest’s stopped page and restarts nothing', () => {
    render(<SharedSessionPane slug="abc" />);
    expect(screen.getByText('sessions.shared.stopped.title')).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
  });
});
