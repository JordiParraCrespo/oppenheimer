import { ProjectEntity, type SessionEntity } from '@oppenheimer/frontend-consumer';
import { sessionCheckout, sessionEntity } from '@oppenheimer/frontend-consumer/testing';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import {
  emptyMessage,
  groupByProject,
  matchesQuery,
  projectsForMove,
  shownGroups,
} from '../lib/session-groups';

/**
 * The sidebar's groups and the move pane's targets
 * (`product/versions/mvp/05-screens.md`): only a project with sessions is
 * drawn, a session whose project is gone still shows, and a session may move
 * to any other project.
 */
const project = (id: string, repos: string[]) =>
  new ProjectEntity(
    id,
    id,
    id,
    id === 'unassigned',
    null,
    null,
    repos.map((githubRepoId) => ({
      id: `${id}-${githubRepoId}`,
      installationId: 'inst',
      githubRepoId,
      fullName: `acme/${githubRepoId}`,
      isDefault: true,
      baseBranch: 'main',
    })),
    new Date(),
    new Date(),
  );

const session = (id: string, projectId: string, repos: string[], name = id): SessionEntity =>
  sessionEntity({
    id,
    projectId,
    name,
    checkouts: repos.map((githubRepoId) => sessionCheckout({ githubRepoId })),
  });

describe('groupByProject', () => {
  it('keeps the projects’ order, includes empty ones, and files orphans last', () => {
    const groups = groupByProject(
      [project('b', ['1']), project('a', ['2'])],
      [session('s1', 'a', ['2']), session('s2', 'gone', ['3']), session('s3', 'b', ['1'])],
    );
    expect(groups.map((group) => group.project?.id ?? null)).toEqual(['b', 'a', null]);
    expect(groups.map((group) => group.sessions.map((s) => s.id))).toEqual([
      ['s3'],
      ['s1'],
      ['s2'],
    ]);
    expect(groupByProject([project('empty', [])], [])[0]?.sessions).toEqual([]);
  });
});

describe('projectsForMove', () => {
  it('offers every other project, whatever repositories it holds', () => {
    const projects = [project('here', ['1']), project('yes', ['1', '2']), project('no', ['2'])];
    expect(projectsForMove(projects, session('s', 'here', ['1'])).map((p) => p.id)).toEqual([
      'yes',
      'no',
    ]);
  });
});

describe('matchesQuery', () => {
  it('narrows on the name, ignoring case and blank queries', () => {
    const row = session('s', 'p', [], 'Wallet empty state');
    expect(matchesQuery(row, '  ')).toBe(true);
    expect(matchesQuery(row, 'EMPTY')).toBe(true);
    expect(matchesQuery(row, 'ledger')).toBe(false);
  });
});

describe('shownGroups', () => {
  const groups = groupByProject(
    [project('a', []), project('b', []), project('c', [])],
    [session('s1', 'a', [])],
  );
  const ids = (list: typeof groups) => list.map((group) => group.project?.id);

  it('drops the groups with no session', () => {
    expect(ids(shownGroups(groups, new Set(), null))).toEqual(['a']);
  });

  it('keeps an empty group whose project still holds a session, as a drag source', () => {
    expect(ids(shownGroups(groups, new Set(['b']), null))).toEqual(['a', 'b']);
  });

  it('keeps the picked project even when nothing in it matches', () => {
    expect(ids(shownGroups(groups, new Set(), 'c'))).toEqual(['a', 'c']);
  });

  it('drops an empty group with no project, whatever project is picked', () => {
    const orphaned = [...groups, { project: null, sessions: [] }];
    expect(ids(shownGroups(orphaned, new Set(), 'c'))).toEqual(['a', 'c']);
  });
});

describe('emptyMessage', () => {
  const t = ((key: string, values?: Record<string, string>) =>
    values ? `${key}:${values.query}` : key) as unknown as TFunction;

  it('says the project is empty when nothing narrows the list', () => {
    expect(emptyMessage(t, false, '')).toBe('sessions.sidebar.emptyProject');
  });

  it('repeats the trimmed search when one narrows the list', () => {
    expect(emptyMessage(t, true, '  deploy ')).toBe('sessions.sidebar.noMatches:deploy');
  });

  it('names the filters when only they narrow the list', () => {
    expect(emptyMessage(t, true, '  ')).toBe('sessions.filters.noMatches');
  });
});
