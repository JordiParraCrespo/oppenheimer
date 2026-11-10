import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { sessionCheckout, sessionEntity } from '@oppenheimer/frontend-consumer/testing';
import { describe, expect, it } from 'vitest';
import {
  ALL,
  activeFilters,
  agentOptions,
  applyFilters,
  DEFAULT_FILTERS,
  facetLabel,
  hostOptions,
  isFiltered,
  pickFacet,
  projectOptions,
  repositoryOptions,
  type SessionFacet,
  type SessionFilters,
  withoutChip,
} from '../lib/session-filters';

/**
 * The sidebar's filter menu (`SessionsConsole.dc.html`): four facets (all but
 * the project built from the rows on screen), one order, and the chips for
 * what is hidden.
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
  sessionEntity({
    id,
    name: over.name ?? id,
    projectId: over.projectId ?? 'p1',
    agent: (over.agent ?? 'claude-code') as SessionEntity['agent'],
    hostId: over.hostId ?? 'h1',
    createdAt: new Date(over.createdAt ?? '2026-01-01T00:00:00Z'),
    checkouts: (over.repos ?? ['acme/api']).map((repositoryFullName) =>
      sessionCheckout({ repositoryFullName }),
    ),
  });

const filters = (over: Partial<SessionFilters>): SessionFilters => ({
  ...DEFAULT_FILTERS,
  ...over,
});

describe('isFiltered', () => {
  it('is on only when a facet narrows, never for the order', () => {
    expect(isFiltered(DEFAULT_FILTERS)).toBe(false);
    expect(isFiltered(filters({ sort: 'name' }))).toBe(false);
    expect(isFiltered(filters({ host: ['h1'] }))).toBe(true);
    expect(isFiltered(filters({ repository: ['acme/api'] }))).toBe(true);
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
    expect(ids(applyFilters(sessions, filters({ project: ['p2'] })))).toEqual(['new']);
    expect(ids(applyFilters(sessions, filters({ repository: ['acme/api'] })))).toEqual([
      'new',
      'old',
    ]);
    expect(ids(applyFilters(sessions, filters({ agent: ['codex'] })))).toEqual(['new']);
    expect(ids(applyFilters(sessions, filters({ host: ['h1'] })))).toEqual(['mid', 'old']);
  });

  it('combines facets', () => {
    expect(
      ids(applyFilters(sessions, filters({ repository: ['acme/web'], host: ['h1'] }))),
    ).toEqual(['mid']);
  });

  it('shows a session when any of its checkouts is one of several picked repositories', () => {
    const more = [...sessions, session('other', { repos: ['acme/docs'] })];
    expect(ids(applyFilters(more, filters({ repository: ['acme/api', 'acme/docs'] })))).toEqual([
      'new',
      'old',
      'other',
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
      activeFilters(
        filters({ host: ['h1'], project: ['p1'], agent: ['codex'], sort: 'name' }),
        options,
      ),
    ).toEqual([
      { key: 'project', value: 'p1', label: 'Web' },
      { key: 'agent', value: 'codex', label: 'codex' },
      { key: 'host', value: 'h1', label: 'laptop' },
    ]);
  });
});

describe('picking', () => {
  const apply = (from: SessionFilters, ...picks: [SessionFacet, string, boolean][]) => {
    let current = from;
    for (const [facet, value, selected] of picks) {
      current = { ...current, ...pickFacet(current, facet, value, selected) };
    }
    return current;
  };

  it('adds and drops repositories one at a time, and "all" empties the set', () => {
    const two = apply(
      DEFAULT_FILTERS,
      ['repository', 'acme/api', true],
      ['repository', 'acme/web', true],
    );
    expect(two.repository).toEqual(['acme/api', 'acme/web']);
    expect(apply(two, ['repository', 'acme/api', false]).repository).toEqual(['acme/web']);
    expect(apply(two, ['repository', ALL, true]).repository).toEqual([]);
  });

  it('replaces the pick on a single-value facet rather than adding to it', () => {
    expect(apply(DEFAULT_FILTERS, ['host', 'h1', true], ['host', 'h2', true]).host).toEqual(['h2']);
  });

  it('labels a facet by its "all" row, its one pick, or a count', () => {
    const options = {
      project: [{ value: ALL, label: 'All projects' }],
      repository: [
        { value: ALL, label: 'All repositories' },
        { value: 'acme/api', label: 'api' },
      ],
      agent: [],
      host: [],
    };
    const several = (count: number) => `${count} picked`;
    expect(facetLabel(DEFAULT_FILTERS, 'project', options, several)).toBe('All projects');
    expect(facetLabel(filters({ repository: ['acme/api'] }), 'repository', options, several)).toBe(
      'api',
    );
    expect(
      facetLabel(filters({ repository: ['acme/api', 'acme/web'] }), 'repository', options, several),
    ).toBe('2 picked');
  });

  it('draws a chip per picked value, and each chip drops only its own', () => {
    const options = {
      project: [],
      repository: [
        { value: 'acme/api', label: 'api' },
        { value: 'acme/web', label: 'web' },
      ],
      agent: [],
      host: [],
    };
    const picked = filters({ repository: ['acme/api', 'acme/web'] });
    const chips = activeFilters(picked, options);

    expect(chips.map((chip) => chip.label)).toEqual(['api', 'web']);
    expect(withoutChip(picked, chips[0]).repository).toEqual(['acme/web']);
  });
});
