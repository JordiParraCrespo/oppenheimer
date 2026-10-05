import type { UserSessionEntity } from '@oppenheimer/frontend-consumer';
import { shareEntities } from '@oppenheimer/frontend-core/react';
import { act, cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DevicesSection } from '../sections/devices';

/**
 * Devices' render budget on its two clocks: a refetch of the signed-in
 * devices (every window focus), and the minute a "last active" moves by. A
 * refetch that changed nothing renders no row; a minute renders the "last
 * active" lines (`RelativeTime` owns its tick) and no row.
 *
 * The rows are counted at `SettingsRow`, the design system's row.
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
  let state = { devices: [] as unknown[], now: 0 };
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
  SettingsRow: ({ label, hint }: { label: string; hint?: ReactNode }) => {
    renders.set(label, (renders.get(label) ?? 0) + 1);
    return (
      <div>
        {label} {hint}
      </div>
    );
  },
  useNow: () => useSyncExternalStore(world.subscribe, () => world.get().now),
}));

const idle = { mutate: vi.fn(), isPending: false, error: null, submittedAt: 0, reset: vi.fn() };
vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useProfileSessions: () => {
    const data = useSyncExternalStore(world.subscribe, () => world.get().devices);
    return { data, isPending: false, error: null };
  },
  useRevokeProfileSession: () => idle,
  useRevokeOtherProfileSessions: () => idle,
}));

const MINUTE = 60_000;
const START = Date.parse('2026-09-26T10:00:00Z');

function device(id: string, current: boolean, minutesAgo: number): UserSessionEntity {
  return {
    id,
    current,
    deviceLabel: id,
    lastSeenAt: new Date(START - minutesAgo * MINUTE),
  } as unknown as UserSessionEntity;
}

const fresh = () => [device('This Mac', true, 2), device('Phone', false, 40)];

function rendered(): string[] {
  const names = [...renders.keys()].filter((name) => (renders.get(name) ?? 0) > 0).sort();
  renders.clear();
  return names;
}

beforeEach(() => {
  world.set({ devices: fresh(), now: START });
  render(<DevicesSection />);
  rendered();
});

afterEach(cleanup);

describe('DevicesSection', () => {
  it('renders no row when a refetch returns the same devices', () => {
    act(() => world.set({ devices: shareEntities(world.get().devices, fresh()) }));
    expect(rendered()).toEqual([]);
  });

  it('moves the last-active lines and renders no row when the minute ticks', () => {
    const before = document.body.textContent;
    act(() => world.set({ now: START + MINUTE }));
    expect(rendered()).toEqual([]);
    expect(document.body.textContent).not.toBe(before);
  });
});
