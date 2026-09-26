import { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { projectPrefill, repositoryKey, toProjectOptions } from '../lib/session-options';

/**
 * What picking a project sets on the other chips, and how the chip lists the
 * projects (`product/versions/mvp/05-screens.md`). The rule that matters: a
 * default the workspace no longer has is skipped, never written.
 */
const LABELS = { noRepositories: 'none', unassigned: 'Sin asignar' };

const repo = (githubRepoId: number, fullName: string, isDefault: boolean, baseBranch: string) => ({
  id: `row-${githubRepoId}`,
  installationId: 'inst-1',
  githubRepoId,
  fullName,
  isDefault,
  baseBranch,
});

function project(
  overrides: {
    defaultHostId?: string | null;
    defaultAgent?: 'codex' | null;
    repositories?: ReturnType<typeof repo>[];
  } = {},
) {
  return new ProjectEntity(
    'p-1',
    'XRP Mobile',
    'xrp-mobile',
    false,
    'defaultHostId' in overrides ? (overrides.defaultHostId ?? null) : 'host-1',
    'defaultAgent' in overrides ? (overrides.defaultAgent ?? null) : 'codex',
    overrides.repositories ?? [
      repo(1, 'acme/atlas', false, 'main'),
      repo(2, 'acme/xrp-mobile', true, 'develop'),
    ],
    new Date(),
    new Date(),
  );
}

describe('projectPrefill', () => {
  it('sets the host, the first default repository with its base branch, and the agent with its default model', () => {
    expect(projectPrefill(project(), ['host-1', 'host-2'])).toEqual({
      hostId: 'host-1',
      scope: [
        { id: repositoryKey({ installationId: 'inst-1', githubRepoId: 2 }), branch: 'develop' },
      ],
      agent: 'codex',
      model: 'gpt-5.6-sol',
    });
  });

  it('skips a host the workspace no longer has, and a project with no defaults sets nothing', () => {
    expect(projectPrefill(project(), ['host-2'])).not.toHaveProperty('hostId');
    const bare = new ProjectEntity(
      'p',
      'Notes',
      'notes',
      false,
      null,
      null,
      [],
      new Date(),
      new Date(),
    );
    expect(projectPrefill(bare, ['host-1'])).toEqual({});
  });
});

describe('toProjectOptions', () => {
  it('names the project and, under it, what every new session clones', () => {
    expect(toProjectOptions([project()], LABELS)).toEqual([
      expect.objectContaining({ value: 'p-1', label: 'XRP Mobile', description: 'xrp-mobile' }),
    ]);
    const bare = new ProjectEntity(
      'p',
      'Notes',
      'notes',
      false,
      null,
      null,
      [],
      new Date(),
      new Date(),
    );
    expect(toProjectOptions([bare], LABELS)[0]?.description).toBe('none');
  });

  it('lists Unassigned first, under its translated name', () => {
    const unassigned = new ProjectEntity(
      'p-u',
      'Unassigned',
      'unassigned',
      true,
      null,
      null,
      [],
      new Date(),
      new Date(),
    );
    expect(toProjectOptions([project(), unassigned], LABELS).map((option) => option.label)).toEqual(
      ['Sin asignar', 'XRP Mobile'],
    );
  });
});
