import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { shareEntities } from '@oppenheimer/frontend-core/react';
import { act, cleanup, render } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionsSidebar } from '../sections/sessions-sidebar';

/**
 * The sessions sidebar's render budget, one assertion per clock.
 *
 * The sidebar is a list on three clocks: the sessions query (a two-second poll
 * while anything is starting, and a refetch on every window focus), the route
 * (which row is highlighted) and the minute its ages move by. It used to redraw
 * every row on the first two and never on the third: each poll handed every
 * row a new entity, the sidebar subscribed to the whole pathname, and each age
 * read the clock during render where nothing could tell it to move.
 *
 * Runs in the `render-budget` project, without the React Compiler. The rows are
 * counted at `SessionItem`, the design system's row.
 */

vi.mock('react-i18next', () => ({
  // `t` echoes its key and the count, so an age that moves changes the text.
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
  // The kit's i18n concern registers itself on import.
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

/** Renders of each row, by session name. */
const renders = vi.hoisted(() => new Map<string, number>());

/**
 * What the sidebar reads, from one store the test drives: the session rows,
 * the route and the clock. Each hook subscribes to its own slice, the way a
 * query observer subscribes to its own key.
 */
const world = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let state = { sessions: [] as unknown[], pathname: '/sessions/new', now: 0 };
  return {
    get: () => state,
    set(patch: Partial<typeof state>) {
      state = { ...state, ...patch };
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock('@oppenheimer/design-system-web', async (original) => ({
  ...(await original<typeof import('@oppenheimer/design-system-web')>()),
  SessionItem: ({ name, age, active }: { name: string; age?: string; active?: boolean }) => {
    renders.set(name, (renders.get(name) ?? 0) + 1);
    return (
      <div data-active={active ? '' : undefined}>
        {name} {age}
      </div>
    );
  },
  useNow: () => useSyncExternalStore(world.subscribe, () => world.get().now),
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSessions: () => {
    const sessions = useSyncExternalStore(world.subscribe, () => world.get().sessions);
    return { data: sessions, isPending: false };
  },
  useHosts: () => ({ data: [] }),
  // No project holds these rows, so they all sit under the one unfiled group.
  useProjects: () => ({ data: [], isPending: false }),
  useRenameSession: () => ({ mutate: vi.fn(), error: null }),
  useMoveSession: () => ({ mutate: vi.fn(), error: null }),
}));

vi.mock('@oppenheimer/frontend-core/react', async (original) => ({
  ...(await original<typeof import('@oppenheimer/frontend-core/react')>()),
  useErrorMessage: () => (_error: unknown, fallback: string) => ({ message: fallback }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: () => null,
  useNavigate: () => vi.fn(),
  // Applies the caller's `select`, as the router does, and compares its result.
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown;
  }) =>
    useSyncExternalStore(world.subscribe, () =>
      select({ location: { pathname: world.get().pathname } }),
    ),
}));

vi.mock('../components/sessions-sidebar-head', () => ({ SessionsSidebarHead: () => null }));
vi.mock('../components/session-row-menu', () => ({ SessionRowMenu: () => null }));

const MINUTE = 60_000;
const START = Date.parse('2026-09-26T10:00:00Z');

function session(id: string, minutesOld: number): SessionEntity {
  return {
    id,
    name: id,
    agent: 'claude-code',
    hostId: 'host-1',
    state: 'working',
    lifecycle: 'running',
    isProvisioning: false,
    projectId: 'project-1',
    checkouts: [],
    createdAt: new Date(START - minutesOld * MINUTE),
  } as unknown as SessionEntity;
}

const ROWS = ['alpha', 'bravo', 'charlie', 'delta', 'echo'].map((id, index) =>
  session(id, index * 10 + 5),
);

/** Which rows rendered since the last call, and resets the count. */
function rendered(): string[] {
  const names = [...renders.keys()].filter((name) => (renders.get(name) ?? 0) > 0).sort();
  renders.clear();
  return names;
}

beforeEach(() => {
  world.set({ sessions: ROWS, pathname: '/sessions/alpha', now: START });
  render(<SessionsSidebar />);
  rendered();
});

afterEach(cleanup);

describe('SessionsSidebar', () => {
  /**
   * A poll that changed nothing. The rows arrive as fresh objects, and go
   * through `shareEntities` the way the list query hands them over, so the
   * sidebar is given back the list it already has.
   */
  it('renders no row when a poll returns the same rows', () => {
    const fresh = ROWS.map((_, index) => session(ROWS[index]?.id ?? '', index * 10 + 5));
    act(() => world.set({ sessions: shareEntities(world.get().sessions, fresh) }));
    expect(rendered()).toEqual([]);
  });

  it('renders only the two rows whose highlight moved on a navigation', () => {
    act(() => world.set({ pathname: '/sessions/delta' }));
    expect(rendered()).toEqual(['alpha', 'delta']);
  });

  it('renders no row on a navigation that leaves the highlight where it was', () => {
    act(() => world.set({ pathname: '/sessions/new' }));
    rendered();
    act(() => world.set({ pathname: '/sessions' }));
    expect(rendered()).toEqual([]);
  });

  /** The ages are an input now: a minute passing moves them. */
  it('moves every age when the minute ticks', () => {
    const before = document.body.textContent;
    act(() => world.set({ now: START + MINUTE }));
    expect(rendered()).toEqual(['alpha', 'bravo', 'charlie', 'delta', 'echo']);
    expect(document.body.textContent).not.toBe(before);
  });
});
