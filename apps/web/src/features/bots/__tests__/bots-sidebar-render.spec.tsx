import type { BotEntity, BotGroupEntity } from '@oppenheimer/frontend-consumer';
import { shareEntities } from '@oppenheimer/frontend-core/react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotsSidebar } from '../sections/bots-sidebar';

/**
 * The Employees sidebar's render budget, one assertion per clock: the bots
 * query (a refetch on focus and after every write), the route (which bot is
 * open), the minute its ages move by, and the search box, whose keystrokes
 * must reach no row until the search settles.
 *
 * The rows are counted at `BotItem`, the design system's row.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: object) => (options ? `${key}:${JSON.stringify(options)}` : key),
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const renders = vi.hoisted(() => new Map<string, number>());

const world = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let state = { bots: [] as unknown[], pathname: '/bots', now: 0 };
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
  BotItem: ({ name, age, active }: { name: string; age?: string; active?: boolean }) => {
    renders.set(name, (renders.get(name) ?? 0) + 1);
    return (
      <div data-active={active ? '' : undefined}>
        {name} {age}
      </div>
    );
  },
  useNow: () => useSyncExternalStore(world.subscribe, () => world.get().now),
}));

const GROUPS = vi.hoisted(
  () => [{ id: 'engineering', name: 'Engineering', position: 0 }] as BotGroupEntity[],
);
const idle = vi.hoisted(() => () => ({
  mutate: () => {},
  reset: () => {},
  isPending: false,
  error: null,
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSuspenseBotsAndGroups: () => {
    const bots = useSyncExternalStore(world.subscribe, () => world.get().bots);
    return { bots, groups: GROUPS, error: null };
  },
  useUpdateBot: idle,
  useRenameBotGroup: idle,
  useDeleteBotGroup: idle,
  useCreateBotGroup: idle,
  useCreateBot: idle,
  useDeleteBot: idle,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: () => null,
  useNavigate: () => vi.fn(),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown;
  }) =>
    useSyncExternalStore(world.subscribe, () =>
      select({ location: { pathname: world.get().pathname } }),
    ),
}));

const MINUTE = 60_000;
const START = Date.parse('2026-10-14T10:00:00Z');

function bot(id: string, groupId: string | null, position: number): BotEntity {
  return {
    id,
    name: id,
    description: '',
    initials: id.slice(0, 2).toUpperCase(),
    avatarColor: 'mint',
    groupId,
    position,
    lastActivityAt: new Date(START - 5 * MINUTE),
  } as unknown as BotEntity;
}

const ROWS = [
  bot('alpha', 'engineering', 0),
  bot('bravo', 'engineering', 1),
  bot('charlie', null, 0),
  bot('delta', null, 1),
];

function rendered(): string[] {
  const names = [...renders.keys()].filter((name) => (renders.get(name) ?? 0) > 0).sort();
  renders.clear();
  return names;
}

beforeEach(() => {
  world.set({ bots: ROWS, pathname: '/bots/alpha', now: START });
  render(<BotsSidebar />);
  rendered();
});

afterEach(cleanup);

describe('BotsSidebar', () => {
  it('renders no row when a refetch returns the same bots', () => {
    const fresh = ROWS.map((row) => bot(row.id, row.groupId, row.position));
    act(() => world.set({ bots: shareEntities(world.get().bots, fresh) }));
    expect(rendered()).toEqual([]);
  });

  it('renders only the two rows whose selection moved on a navigation', () => {
    act(() => world.set({ pathname: '/bots/charlie' }));
    expect(rendered()).toEqual(['alpha', 'charlie']);
  });

  it('renders no row going from a bot’s chat to its settings', () => {
    act(() => world.set({ pathname: '/bots/alpha/settings/profile' }));
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
      const search = screen.getByRole('textbox', { name: 'bots.sidebar.search' });
      for (const draft of ['d', 'de', 'del']) {
        act(() => {
          fireEvent.change(search, { target: { value: draft } });
          vi.advanceTimersByTime(50);
        });
      }
      expect(rendered()).toEqual([]);

      act(() => vi.advanceTimersByTime(1_000));
      expect(rendered()).toEqual(['delta']);
      expect(document.body.textContent).not.toContain('charlie');
    } finally {
      vi.useRealTimers();
    }
  });
});
