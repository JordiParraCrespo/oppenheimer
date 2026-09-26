import { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import {
  projectPrefill,
  repositoryKey,
  toProjectOptions,
  toProjectRepositoryInputs,
} from '../lib/session-options';

/**
 * What picking a project sets on the other chips, and what the dialog sends
 * (`product/versions/mvp/12-projects-on-the-console.md`). The rule that
 * matters: a default the workspace no longer has is skipped, never written.
 */
const repo = (
  githubRepoId: number,
  fullName: string,
  isDefault: boolean,
  baseBranch: string | null,
) => ({
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
    null,
    'defaultHostId' in overrides ? (overrides.defaultHostId ?? null) : 'host-1',
    'defaultAgent' in overrides ? (overrides.defaultAgent ?? null) : 'codex',
    overrides.repositories ?? [
      repo(1, 'acme/atlas', false, null),
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
      null,
      null,
      null,
      [],
      new Date(),
      new Date(),
    );
    expect(projectPrefill(bare, ['host-1'])).toEqual({});
  });

  it('leaves the branch empty for a default repository on its own default branch', () => {
    const own = project({ repositories: [repo(2, 'acme/xrp-mobile', true, null)] });
    expect(projectPrefill(own, []).scope?.[0]?.branch).toBe('');
  });
});

describe('toProjectOptions', () => {
  it('names the project and, under it, what every new session clones', () => {
    expect(toProjectOptions([project()], { noRepositories: 'none' })).toEqual([
      expect.objectContaining({ value: 'p-1', label: 'XRP Mobile', description: 'xrp-mobile' }),
    ]);
    const bare = new ProjectEntity(
      'p',
      'Notes',
      'notes',
      null,
      null,
      null,
      [],
      new Date(),
      new Date(),
    );
    expect(toProjectOptions([bare], { noRepositories: 'none' })[0]?.description).toBe('none');
  });
});

describe('toProjectRepositoryInputs', () => {
  const id = repositoryKey({ installationId: 'inst-1', githubRepoId: 2 });

  it('sends a base branch only when it is not the repository’s own default', () => {
    const defaults = new Map([[id, 'main']]);
    expect(toProjectRepositoryInputs([{ id, isDefault: true, branch: 'main' }], defaults)).toEqual([
      { installationId: 'inst-1', githubRepoId: 2, isDefault: true },
    ]);
    expect(
      toProjectRepositoryInputs([{ id, isDefault: false, branch: 'develop' }], defaults),
    ).toEqual([
      { installationId: 'inst-1', githubRepoId: 2, isDefault: false, baseBranch: 'develop' },
    ]);
  });

  it('drops a row whose id names nothing this screen knows', () => {
    expect(
      toProjectRepositoryInputs([{ id: 'garbage', isDefault: true, branch: '' }], new Map()),
    ).toEqual([]);
  });
});
