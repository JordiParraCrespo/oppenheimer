import type { PullRequestEntity } from '@oppenheimer/frontend-consumer';
import { shareEntities } from '@oppenheimer/frontend-core/react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueueTable } from '../sections/queue-table';

/**
 * The queue table's render budget on its clocks: typing in the search, the
 * search settling, and a refetch of the queue. The half-typed word is the
 * field's, so a burst of keystrokes renders no row until it settles; a
 * refetch that changed nothing comes back through `shareEntities` as the rows
 * already drawn, and renders none.
 *
 * The rows are counted at `PullRequestRow`, the design system's row.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const renders = vi.hoisted(() => new Map<string, number>());

const world = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let queue: unknown;
  return {
    get: () => queue,
    set(next: unknown) {
      queue = next;
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
  PullRequestRow: ({ title }: { title: string }) => {
    renders.set(title, (renders.get(title) ?? 0) + 1);
    return <div>{title}</div>;
  },
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  usePullRequestQueue: () => {
    const data = useSyncExternalStore(world.subscribe, world.get);
    return { data, isPending: false, isError: false, error: null, status: 'success' };
  },
  useMergePullRequest: () => ({ isSuccess: false, isPending: false, mutate: vi.fn() }),
}));

vi.mock('@oppenheimer/frontend-core/react', async (original) => ({
  ...(await original<typeof import('@oppenheimer/frontend-core/react')>()),
  useErrorMessage: () => (_error: unknown, fallback: string) => ({ message: fallback }),
}));

vi.mock('../hooks/use-queue-search', () => ({
  useQueueSearch: () => ({
    scope: 'mine',
    lane: undefined,
    repo: undefined,
    setScope: vi.fn(),
    setLane: vi.fn(),
  }),
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

function pull(title: string, number: number): PullRequestEntity {
  return {
    title,
    number,
    installationId: 'installation-1',
    githubRepoId: 1,
    repository: 'acme/web',
    reference: `acme/web#${number}`,
    address: { installationId: 'installation-1', githubRepoId: 1, number },
    author: 'ada',
    authorKind: 'person',
    headRef: `feature/${title}`,
    lane: 'quick',
    blocker: null,
    additions: 1,
    deletions: 1,
    checks: 'passing',
    hasConflicts: false,
    waitingSeconds: 60,
  } as unknown as PullRequestEntity;
}

const TITLES = ['alpha', 'bravo', 'charlie', 'delta'];

function queue() {
  return { items: TITLES.map((title, index) => pull(title, index + 1)), unreadable: [] };
}

function rendered(): string[] {
  const names = [...renders.keys()].filter((name) => (renders.get(name) ?? 0) > 0).sort();
  renders.clear();
  return names;
}

beforeEach(() => {
  vi.useFakeTimers();
  world.set(queue());
  render(<QueueTable />);
  rendered();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('QueueTable', () => {
  it('renders no row while the search is being typed, then only the rows that match', () => {
    const field = screen.getByRole('textbox', { name: 'pullRequests.queue.search' });
    for (const draft of ['c', 'ch', 'cha']) fireEvent.change(field, { target: { value: draft } });

    expect(rendered()).toEqual([]);

    act(() => vi.runAllTimers());
    expect(screen.queryByText('alpha')).toBeNull();
    expect(rendered()).toEqual(['charlie']);
  });

  it('renders no row when a refetch returns the same queue', () => {
    act(() => world.set(shareEntities(world.get(), queue())));
    expect(rendered()).toEqual([]);
  });
});
