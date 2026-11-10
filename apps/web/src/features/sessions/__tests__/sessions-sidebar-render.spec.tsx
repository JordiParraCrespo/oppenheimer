import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { sessionEntity } from '@oppenheimer/frontend-consumer/testing';
import { shareEntities } from '@oppenheimer/frontend-core/react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleDialogProvider } from '@/lib/console';
import { FOLDED_SESSIONS_KEY } from '../hooks/use-folded-sessions';
import { PINNED_ONLY_KEY } from '../hooks/use-pinned-only';
import { SESSION_PINS_KEY } from '../lib/session-pins';
import { SessionsSidebar } from '../sections/sessions-sidebar';

/**
 * The sessions sidebar's render budget, one assertion per clock: the sessions
 * query (a poll while anything starts, a refetch on window focus), the route,
 * the minute ages move by, and the search box. It guards against a poll
 * handing every row a new entity, a subscription to the whole pathname, and
 * ages reading the clock in render. Rows are counted at `SortableSessionItem`.
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
  SortableSessionItem: ({
    name,
    age,
    active,
    selected,
    onClick,
  }: {
    name: string;
    age?: string;
    active?: boolean;
    selected?: boolean;
    onClick?: (event: React.MouseEvent) => void;
  }) => {
    renders.set(name, (renders.get(name) ?? 0) + 1);
    return (
      // biome-ignore lint/a11y/useSemanticElements: a stand-in for the row's link, clicked by name.
      <div
        role="button"
        tabIndex={-1}
        aria-label={name}
        data-active={active ? '' : undefined}
        aria-pressed={selected}
        onClick={onClick}
        onKeyDown={() => {}}
      >
        {name} {age}
      </div>
    );
  },
  useNow: () => useSyncExternalStore(world.subscribe, () => world.get().now),
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  // No project holds these rows, so they all sit under the one unfiled group.
  useSuspenseSessionsSidebar: () => {
    const sessions = useSyncExternalStore(world.subscribe, () => world.get().sessions);
    return { sessions, projects: [], hosts: [], error: null };
  },
  useProjectsSnapshot: () => () => [],
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
  useMatchRoute: () => () => false,
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

// The head is real, so a keystroke goes through the search box the way it
// does in the app; its menus are not what this budgets.
vi.mock('../components/sessions-filter-menu', () => ({ SessionsFilterMenu: () => null }));
vi.mock('../components/session-filter-chips', () => ({ SessionFilterChips: () => null }));
vi.mock('../sections/new-session-button', () => ({ NewSessionButton: () => null }));
vi.mock('../components/session-row-menu', () => ({ SessionRowMenu: () => null }));

const MINUTE = 60_000;
const START = Date.parse('2026-09-26T10:00:00Z');

function session(id: string, minutesOld: number): SessionEntity {
  return sessionEntity({ id, createdAt: new Date(START - minutesOld * MINUTE) });
}

const ROWS = ['alpha', 'bravo', 'charlie', 'delta', 'echo'].map((id, index) =>
  session(id, index * 10 + 5),
);

function rendered(): string[] {
  const names = [...renders.keys()].filter((name) => (renders.get(name) ?? 0) > 0).sort();
  renders.clear();
  return names;
}

beforeEach(() => {
  // The drag layer asks whether the reader prefers reduced motion; jsdom has no media queries.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  world.set({ sessions: ROWS, pathname: '/sessions/alpha', now: START });
  // The console's dialog owner sits above the sidebar in the app; here it
  // holds nothing and renders nothing, so it costs the budget no row.
  render(
    <ConsoleDialogProvider>
      <SessionsSidebar />
    </ConsoleDialogProvider>,
  );
  rendered();
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('SessionsSidebar', () => {
  /**
   * The rows arrive as fresh objects and go through `shareEntities` the way
   * the list query hands them over, so the sidebar is given back the list it
   * already has.
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

  it('moves every age when the minute ticks', () => {
    const before = document.body.textContent;
    act(() => world.set({ now: START + MINUTE }));
    expect(rendered()).toEqual(['alpha', 'bravo', 'charlie', 'delta', 'echo']);
    expect(document.body.textContent).not.toBe(before);
  });

  /**
   * Entering selection redraws every row, since each glyph turns into a box;
   * after that a pick redraws the row it picked and no other.
   */
  it('renders only the picked row once the list is selecting', () => {
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'bravo' }), { metaKey: true });
    });
    expect(rendered()).toEqual(['alpha', 'bravo', 'charlie', 'delta', 'echo']);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'delta' }));
    });
    expect(rendered()).toEqual(['delta']);
    expect(screen.getByRole('button', { name: 'delta' }).getAttribute('aria-pressed')).toBe('true');
  });

  /** The bar reads the sidebar's pins, so Pin selected pins what is picked. */
  it('pins the picked rows from the selection bar', () => {
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'bravo' }), { metaKey: true });
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'delta' }));
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'sessions.selection.pin' }));
    });
    expect(JSON.parse(window.localStorage.getItem(SESSION_PINS_KEY) ?? '[]')).toEqual([
      'bravo',
      'delta',
    ]);
    expect(screen.getByText('sessions.sidebar.pinned')).toBeTruthy();
    window.localStorage.clear();
  });

  /** The half-typed word is the search box's; only the settled one reaches the list. */
  it('renders no row while typing, and the matching row once when typing settles', () => {
    vi.useFakeTimers();
    try {
      const search = screen.getByRole('textbox', { name: 'sessions.sidebar.search' });
      for (const draft of ['a', 'al', 'alp', 'alph']) {
        act(() => {
          fireEvent.change(search, { target: { value: draft } });
          vi.advanceTimersByTime(50);
        });
      }
      expect(rendered()).toEqual([]);

      act(() => vi.advanceTimersByTime(1_000));
      expect(rendered()).toEqual(['alpha']);
      expect(document.body.textContent).not.toContain('bravo');
    } finally {
      vi.useRealTimers();
    }
  });

  /** The Sessions heading folds the list away like a Bots heading, and the fold is kept. */
  it('folds every row and the search away under the Sessions heading', () => {
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'sessions.sidebar.sessions' }));
    });
    expect(screen.queryByRole('button', { name: 'alpha' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'sessions.sidebar.search' })).toBeNull();
    expect(window.localStorage.getItem(FOLDED_SESSIONS_KEY)).toBe('["sessions"]');

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'sessions.sidebar.sessions' }));
    });
    expect(screen.getByRole('button', { name: 'alpha' })).toBeTruthy();
    window.localStorage.clear();
  });

  /**
   * Pinned only, kept on this device, draws the pinned rows and no project
   * group; with nothing pinned, the list says how to pin one.
   */
  it('draws only the pinned rows under Pinned only', () => {
    window.localStorage.setItem(SESSION_PINS_KEY, JSON.stringify(['bravo']));
    window.localStorage.setItem(PINNED_ONLY_KEY, JSON.stringify(['projects']));
    try {
      cleanup();
      render(
        <ConsoleDialogProvider>
          <SessionsSidebar />
        </ConsoleDialogProvider>,
      );
      expect(screen.getByRole('button', { name: 'bravo' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'alpha' })).toBeNull();

      cleanup();
      window.localStorage.setItem(SESSION_PINS_KEY, '[]');
      render(
        <ConsoleDialogProvider>
          <SessionsSidebar />
        </ConsoleDialogProvider>,
      );
      expect(screen.getByText('sessions.sidebar.noPinned')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'alpha' })).toBeNull();
    } finally {
      window.localStorage.clear();
    }
  });

  /** A search outlives a fold: the box comes back holding what still narrows the list. */
  it('keeps a settled search, in the box and on the list, across a fold', () => {
    vi.useFakeTimers();
    try {
      act(() => {
        fireEvent.change(screen.getByRole('textbox', { name: 'sessions.sidebar.search' }), {
          target: { value: 'alpha' },
        });
        vi.advanceTimersByTime(1_000);
      });
      const heading = screen.getByRole('button', { name: 'sessions.sidebar.sessions' });
      act(() => fireEvent.click(heading));
      act(() => fireEvent.click(heading));
      const search = screen.getByRole('textbox', { name: 'sessions.sidebar.search' });
      expect((search as HTMLInputElement).value).toBe('alpha');
      expect(screen.queryByRole('button', { name: 'bravo' })).toBeNull();
    } finally {
      vi.useRealTimers();
      window.localStorage.clear();
    }
  });
});
