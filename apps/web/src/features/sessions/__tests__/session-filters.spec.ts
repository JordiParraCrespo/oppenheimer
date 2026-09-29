import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import {
  ALL,
  activeFilters,
  agentOptions,
  applyFilters,
  DEFAULT_FILTERS,
  hostOptions,
  isFiltered,
  projectOptions,
  repositoryOptions,
  type SessionFilters,
} from '../lib/session-filters';

/**
 * The sidebar's filter menu (`SessionsConsole.dc.html`): three facets built
 * from the rows on screen, one order, and the chips for what is hidden.
 */

const session = (
  id: string,
  over: Partial<{
    projectId: string;
    agent: string;
    hostId: string;
    repos: string[];
    createdAt: string;
    name: string;
  }> = {},
) =>
  ({
    id,
    name: over.name ?? id,
    projectId: over.projectId ?? 'p1',
    agent: over.agent ?? 'claude-code',
    hostId: over.hostId ?? 'h1',
    createdAt: new Date(over.createdAt ?? '2026-01-01T00:00:00Z'),
    checkouts: (over.repos ?? ['acme/api']).map((repositoryFullName) => ({ repositoryFullName })),
  }) as unknown as SessionEntity;

const filters = (over: Partial<SessionFilters>): SessionFilters => ({
  ...DEFAULT_FILTERS,
  ...over,
});

describe('isFiltered', () => {
  it('is on only when a facet narrows, never for the order', () => {
    expect(isFiltered(DEFAULT_FILTERS)).toBe(false);
    expect(isFiltered(filters({ sort: 'name' }))).toBe(false);
    expect(isFiltered(filters({ host: 'h1' }))).toBe(true);
  });
});

describe('facet options', () => {
  const sessions = [
    session('a', { repos: ['acme/web', 'acme/api'], agent: 'codex', hostId: 'h2' }),
    session('b', { repos: ['acme/api'], hostId: 'h1' }),
  ];

  it('starts every facet on "all"', () => {
    for (const options of [
      projectOptions(undefined, 'All'),
      repositoryOptions([], 'All'),
      agentOptions([], 'All', String),
      hostOptions([], undefined, 'All'),
    ]) {
      expect(options).toEqual([{ value: ALL, label: 'All' }]);
    }
  });

  it('offers every checkout once, sorted, labelled by its repository name', () => {
    expect(repositoryOptions(sessions, 'All').slice(1)).toEqual([
      { value: 'acme/api', label: 'api' },
      { value: 'acme/web', label: 'web' },
    ]);
  });

  it('offers each agent once, labelled by the caller', () => {
    expect(agentOptions(sessions, 'All', (agent) => agent.toUpperCase()).slice(1)).toEqual([
      { value: 'claude-code', label: 'CLAUDE-CODE' },
      { value: 'codex', label: 'CODEX' },
    ]);
  });

  it('names hosts from the host list, keeping the id of one it has not answered for', () => {
    expect(hostOptions(sessions, [{ id: 'h1', name: 'laptop' }], 'All').slice(1)).toEqual([
      { value: 'h1', label: 'laptop' },
      { value: 'h2', label: 'h2' },
    ]);
  });

  it('lists projects as given', () => {
    expect(projectOptions([{ id: 'p1', name: 'Web' }], 'All')).toEqual([
      { value: ALL, label: 'All' },
      { value: 'p1', label: 'Web' },
    ]);
  });
});

describe('applyFilters', () => {
  const sessions = [
    session('old', { createdAt: '2026-01-01T00:00:00Z', name: 'b', projectId: 'p1' }),
    session('new', {
      createdAt: '2026-03-01T00:00:00Z',
      name: 'c',
      projectId: 'p2',
      repos: ['acme/web', 'acme/api'],
      agent: 'codex',
      hostId: 'h2',
    }),
    session('mid', { createdAt: '2026-02-01T00:00:00Z', name: 'a', repos: ['acme/web'] }),
  ];
  const ids = (list: SessionEntity[]) => list.map((s) => s.id);

  it('orders newest first by default, oldest first, or by name', () => {
    expect(ids(applyFilters(sessions, DEFAULT_FILTERS))).toEqual(['new', 'mid', 'old']);
    expect(ids(applyFilters(sessions, filters({ sort: 'oldest' })))).toEqual(['old', 'mid', 'new']);
    expect(ids(applyFilters(sessions, filters({ sort: 'name' })))).toEqual(['mid', 'old', 'new']);
  });

  it('narrows by each facet, matching a repository on any checkout', () => {
    expect(ids(applyFilters(sessions, filters({ project: 'p2' })))).toEqual(['new']);
    expect(ids(applyFilters(sessions, filters({ repository: 'acme/api' })))).toEqual([
      'new',
      'old',
    ]);
    expect(ids(applyFilters(sessions, filters({ agent: 'codex' })))).toEqual(['new']);
    expect(ids(applyFilters(sessions, filters({ host: 'h1' })))).toEqual(['mid', 'old']);
  });

  it('combines facets', () => {
    expect(ids(applyFilters(sessions, filters({ repository: 'acme/web', host: 'h1' })))).toEqual([
      'mid',
    ]);
  });

  it("never reorders the query's own array", () => {
    const before = ids(sessions);
    applyFilters(sessions, filters({ sort: 'name' }));
    expect(ids(sessions)).toEqual(before);
  });
});

describe('activeFilters', () => {
  it('names a chip per narrowing facet, in menu order, falling back to the value', () => {
    const options = {
      project: [{ value: 'p1', label: 'Web' }],
      repository: [],
      agent: [],
      host: [{ value: 'h1', label: 'laptop' }],
    };

    expect(
      activeFilters(filters({ host: 'h1', project: 'p1', agent: 'codex', sort: 'name' }), options),
    ).toEqual([
      { key: 'project', label: 'Web' },
      { key: 'agent', label: 'codex' },
      { key: 'host', label: 'laptop' },
    ]);
  });
});
