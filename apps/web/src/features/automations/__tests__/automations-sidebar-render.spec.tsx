import type { AutomationEntity, ProjectEntity } from '@oppenheimer/frontend-consumer';
import { shareEntities } from '@oppenheimer/frontend-core/react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleDialogProvider } from '@/lib/console';
import { AutomationsSidebar } from '../sections/automations-sidebar';

/**
 * The automations sidebar's render budget, one assertion per clock: the
 * automations query (a refetch on focus and after every write), the route
 * (which automation is selected), the minute its ages move by, and the search
 * box.
 *
 * Runs in the `render-budget` project, without the React Compiler. The rows are
 * counted at `RoutineItem`, the design system's row.
 */

vi.mock('react-i18next', () => ({
  // `t` echoes its key and its values, so an age that moves changes the text.
  useTranslation: () => ({
    t: (key: string, options?: object) => (options ? `${key}:${JSON.stringify(options)}` : key),
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

/** Renders of each row, by automation name. */
const renders = vi.hoisted(() => new Map<string, number>());

/** What the sidebar reads, from one store the test drives. */
const world = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let state = { automations: [] as unknown[], pathname: '/automations', now: 0 };
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
  RoutineItem: ({ name, meta, active }: { name: string; meta?: string; active?: boolean }) => {
    renders.set(name, (renders.get(name) ?? 0) + 1);
    return (
      <div data-active={active ? '' : undefined}>
        {name} {meta}
      </div>
    );
  },
  useNow: () => useSyncExternalStore(world.subscribe, () => world.get().now),
}));

const PROJECTS = [{ id: 'project-1', name: 'Web', isUnassigned: false }] as ProjectEntity[];

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useAutomations: () => {
    const automations = useSyncExternalStore(world.subscribe, () => world.get().automations);
    return { data: automations, isPending: false, error: null };
  },
  useProjects: () => ({ data: PROJECTS, isPending: false, error: null }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: () => null,
  useMatchRoute: () => () => false,
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown;
  }) =>
    useSyncExternalStore(world.subscribe, () =>
      select({ location: { pathname: world.get().pathname } }),
    ),
}));

vi.mock('../components/trigger-glyph', () => ({ TriggerGlyph: () => null }));

const MINUTE = 60_000;
const START = Date.parse('2026-09-26T10:00:00Z');

function automation(id: string): AutomationEntity {
  return {
    id,
    name: id,
    projectId: 'project-1',
    isScheduled: true,
    isRunning: false,
    isPaused: false,
    nextRunAt: new Date(START + 5 * MINUTE),
    lastRuns: [],
  } as unknown as AutomationEntity;
}

const ROWS = ['alpha', 'bravo', 'charlie', 'delta'].map(automation);

/** Which rows rendered since the last call (All automations aside), and resets the count. */
function rendered(): string[] {
  const names = [...renders.keys()]
    .filter((name) => name !== 'automations.sidebar.all' && (renders.get(name) ?? 0) > 0)
    .sort();
  renders.clear();
  return names;
}

beforeEach(() => {
  world.set({ automations: ROWS, pathname: '/automations/alpha', now: START });
  render(
    <ConsoleDialogProvider>
      <AutomationsSidebar />
    </ConsoleDialogProvider>,
  );
  rendered();
});

afterEach(cleanup);

describe('AutomationsSidebar', () => {
  it('renders no row when a refetch returns the same automations', () => {
    const fresh = ROWS.map((row) => automation(row.id));
    act(() => world.set({ automations: shareEntities(world.get().automations, fresh) }));
    expect(rendered()).toEqual([]);
  });

  it('renders only the two rows whose selection moved on a navigation', () => {
    act(() => world.set({ pathname: '/automations/charlie' }));
    expect(rendered()).toEqual(['alpha', 'charlie']);
  });

  it('renders no row on a navigation between pages that select none', () => {
    act(() => world.set({ pathname: '/automations/runs' }));
    rendered();
    act(() => world.set({ pathname: '/automations' }));
    expect(rendered()).toEqual([]);
  });

  it('moves every age when the minute ticks', () => {
    const before = document.body.textContent;
    act(() => world.set({ now: START + MINUTE }));
    expect(rendered()).toEqual(['alpha', 'bravo', 'charlie', 'delta']);
    expect(document.body.textContent).not.toBe(before);
  });

  it('renders no row while typing, and the matching row once when typing settles', () => {
    vi.useFakeTimers();
    try {
      const search = screen.getByRole('textbox', { name: 'automations.sidebar.search' });
      for (const draft of ['b', 'br', 'bra']) {
        act(() => {
          fireEvent.change(search, { target: { value: draft } });
          vi.advanceTimersByTime(50);
        });
      }
      expect(rendered()).toEqual([]);

      act(() => vi.advanceTimersByTime(1_000));
      expect(rendered()).toEqual(['bravo']);
      expect(document.body.textContent).not.toContain('charlie');
    } finally {
      vi.useRealTimers();
    }
  });
});
