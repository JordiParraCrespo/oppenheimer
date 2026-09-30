import { ProjectEntity, type SessionEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { groupByProject, matchesQuery, projectsForMove } from '../lib/session-groups';

/**
 * The sidebar's groups and the move pane's targets
 * (`product/versions/mvp/05-screens.md`): every project is a group even when
 * empty, a session whose project is gone still shows, and a session may move
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

const session = (id: string, projectId: string, repos: string[], name = id) =>
  ({
    id,
    projectId,
    name,
    checkouts: repos.map((githubRepoId) => ({ githubRepoId })),
  }) as unknown as SessionEntity;

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

describe('groupByProject, Unassigned', () => {
  it('puts the Unassigned project first', () => {
    const groups = groupByProject([project('newer', []), project('unassigned', [])], []);
    expect(groups.map((group) => group.project?.id)).toEqual(['unassigned', 'newer']);
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
