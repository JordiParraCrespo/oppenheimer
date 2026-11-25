import { describe, expect, it } from 'vitest';
import { sessionCheckout, sessionEntity } from '../../../testing';
import { ProjectEntity } from '../../projects/project.entity';
import type { SessionEntity } from '../session.entity';
import { groupByProject, matchesQuery } from '../session-groups';

/**
 * How a session list is grouped and searched, for the console's sidebar and
 * the phone's Sessions tab: a project keeps its place, a session whose
 * project is gone still shows, and the search narrows on the name.
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

describe('matchesQuery', () => {
  it('narrows on the name, ignoring case and blank queries', () => {
    const row = session('s', 'p', [], 'Wallet empty state');
    expect(matchesQuery(row, '  ')).toBe(true);
    expect(matchesQuery(row, 'EMPTY')).toBe(true);
    expect(matchesQuery(row, 'ledger')).toBe(false);
  });
});
