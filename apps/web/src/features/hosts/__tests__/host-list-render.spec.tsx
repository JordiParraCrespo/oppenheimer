import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { shareEntities } from '@oppenheimer/frontend-core/react';
import { act, cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HostList } from '../sections/host-list';

/**
 * The host list's render budget on its two clocks: the fifteen-second poll,
 * and the minute a host's "last seen" moves by. A poll that changed nothing
 * renders no card; a minute renders the "last seen" line (`RelativeTime` owns
 * its tick) and no card.
 *
 * The cards are counted at `HostCard`, the design system's card.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: object) => (options ? `${key}:${JSON.stringify(options)}` : key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const renders = vi.hoisted(() => new Map<string, number>());

const world = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let state = { hosts: [] as unknown[], now: 0 };
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
  HostCard: ({ name, seen }: { name: string; seen?: ReactNode }) => {
    renders.set(name, (renders.get(name) ?? 0) + 1);
    return (
      <div>
        {name} {seen}
      </div>
    );
  },
  useNow: () => useSyncExternalStore(world.subscribe, () => world.get().now),
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useHostPresence: () => {
    const data = useSyncExternalStore(world.subscribe, () => world.get().hosts);
    return { data, isPending: false, error: null };
  },
  useRenameHost: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useSetHostSessionLimit: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

vi.mock('../components/host-actions-menu', () => ({ HostActionsMenu: () => null }));

const MINUTE = 60_000;
const START = Date.parse('2026-09-26T10:00:00Z');

function host(id: string, minutesAgo: number): HostEntity {
  return {
    id,
    name: id,
    online: false,
    status: 'offline',
    lastSeenAt: new Date(START - minutesAgo * MINUTE),
    details: { runningSessionCount: 0 },
  } as unknown as HostEntity;
}

const fresh = () => [host('mac-studio', 5), host('build-box', 30)];

function rendered(): string[] {
  const names = [...renders.keys()].filter((name) => (renders.get(name) ?? 0) > 0).sort();
  renders.clear();
  return names;
}

beforeEach(() => {
  world.set({ hosts: fresh(), now: START });
  render(<HostList />);
  rendered();
});

afterEach(cleanup);

describe('HostList', () => {
  it('renders no card when a poll returns the same hosts', () => {
    act(() => world.set({ hosts: shareEntities(world.get().hosts, fresh()) }));
    expect(rendered()).toEqual([]);
  });

  it('moves the last-seen lines and renders no card when the minute ticks', () => {
    const before = document.body.textContent;
    act(() => world.set({ now: START + MINUTE }));
    expect(rendered()).toEqual([]);
    expect(document.body.textContent).not.toBe(before);
  });
});
