import type { AutomationRunEntity } from '@oppenheimer/frontend-consumer';
import { shareEntities } from '@oppenheimer/frontend-core/react';
import { act, cleanup, render } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunsTable } from '../sections/runs-table';

/**
 * The runs table's render budget on its one clock: the poll. While any run on
 * the page is live the list refetches every few seconds, and a refetch hands
 * back new objects for every run. Through `shareEntities` a page that did not
 * change comes back as the page already drawn, so a poll that changed nothing
 * renders no row.
 *
 * Runs in the `render-budget` project, without the React Compiler. The rows are
 * counted at `RunRow`, the design system's row.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const renders = vi.hoisted(() => new Map<string, number>());

const world = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let page: unknown;
  return {
    get: () => page,
    set(next: unknown) {
      page = next;
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
  RunRow: ({ title, state }: { title: string; state: string }) => {
    renders.set(title, (renders.get(title) ?? 0) + 1);
    return (
      <div>
        {title} {state}
      </div>
    );
  },
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useAutomationRuns: () => {
    const data = useSyncExternalStore(world.subscribe, world.get);
    return { data, isPending: false, error: null, isPlaceholderData: false };
  },
  useAutomations: () => ({ data: undefined }),
  useProjects: () => ({ data: undefined }),
}));

vi.mock('@oppenheimer/frontend-web', async (original) => ({
  ...(await original<typeof import('@oppenheimer/frontend-web')>()),
  useLocale: () => 'en',
}));

vi.mock('../hooks/use-runs-filters', async (original) => ({
  ...(await original<typeof import('../hooks/use-runs-filters')>()),
  useRunsFilters: () => ({
    state: { status: 'all', automation: null, project: null, window: '30d', page: 1 },
    filter: {},
    dirty: false,
  }),
}));

vi.mock('@tanstack/react-router', () => ({ getRouteApi: () => ({}), useNavigate: () => vi.fn() }));
vi.mock('../components/choice-token', () => ({ ChoiceToken: () => null }));

const START = Date.parse('2026-09-26T10:00:00Z');

function run(id: string, status: string): AutomationRunEntity {
  return {
    id,
    title: id,
    status,
    automationId: 'automation-1',
    automationName: 'Nightly',
    automationDeleted: false,
    sessionId: `session-${id}`,
    skipReason: null,
    createdAt: new Date(START),
  } as unknown as AutomationRunEntity;
}

function page(statuses: Record<string, string>) {
  const items = Object.entries(statuses).map(([id, status]) => run(id, status));
  return {
    items,
    total: items.length,
    page: 1,
    counts: { all: items.length, completed: 0, failed: 0, running: items.length },
  };
}

const LIVE = { alpha: 'running', bravo: 'completed', charlie: 'completed' };

function rendered(): string[] {
  const names = [...renders.keys()].filter((name) => (renders.get(name) ?? 0) > 0).sort();
  renders.clear();
  return names;
}

beforeEach(() => {
  world.set(page(LIVE));
  render(<RunsTable />);
  rendered();
});

afterEach(cleanup);

describe('RunsTable', () => {
  it('renders no row when a poll returns the same page', () => {
    act(() => world.set(shareEntities(world.get(), page(LIVE))));
    expect(rendered()).toEqual([]);
  });

  it('draws the run that changed when a poll moves one', () => {
    act(() => world.set(shareEntities(world.get(), page({ ...LIVE, alpha: 'completed' }))));
    expect(rendered()).toContain('alpha');
    expect(document.body.textContent).toContain('alpha completed');
  });
});
