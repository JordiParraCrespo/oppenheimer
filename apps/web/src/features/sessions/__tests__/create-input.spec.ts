import { describe, expect, it } from 'vitest';
import type { NewSessionDraft } from '../lib/new-session-draft';
import { hasPlace, toCreateInput, toStartCloudInput } from '../lib/session-options';

/**
 * What New session posts for each place (`product/versions/mvp/24-session-places.md`):
 * a folder and no checkouts, or a checkout per repository and no folder —
 * never both, and
 * nothing while the draft names no place.
 */
const draft: NewSessionDraft = {
  where: 'worktree',
  cloudProvider: 'cursor',
  cloudModel: null,
  projectId: null,
  hostId: 'host-1',
  scope: [{ id: 'installation-1:42', branch: 'main' }],
  folder: '/home/jordi/notes',
  agent: 'claude-code',
  model: null,
  permission: 'auto',
  efforts: {},
};

const extras = { prompt: 'Fix it', attachmentIds: [] };

describe('toCreateInput', () => {
  it('sends a worktree session with its checkout and no folder', () => {
    const input = toCreateInput(draft, extras);

    expect(input).toMatchObject({
      hostId: 'host-1',
      checkouts: [{ installationId: 'installation-1', githubRepoId: 42, baseBranch: 'main' }],
      prompt: 'Fix it',
    });
    expect(input).not.toHaveProperty('folder');
  });

  it('sends a checkout for every picked repository, each on its own base', () => {
    const input = toCreateInput(
      {
        ...draft,
        scope: [
          { id: 'installation-1:42', branch: 'main' },
          { id: 'installation-1:7', branch: 'develop' },
        ],
      },
      extras,
    );

    expect(input?.checkouts).toEqual([
      { installationId: 'installation-1', githubRepoId: 42, baseBranch: 'main' },
      { installationId: 'installation-1', githubRepoId: 7, baseBranch: 'develop' },
    ]);
  });

  it('sends a folder session with its folder and project, and no checkouts', () => {
    const input = toCreateInput({ ...draft, where: 'folder', projectId: 'project-1' }, extras);

    expect(input).toEqual({
      hostId: 'host-1',
      agent: 'claude-code',
      projectId: 'project-1',
      folder: '/home/jordi/notes',
      launch: { model: null, permission: 'auto' },
      prompt: 'Fix it',
    });
  });

  it('sends the blank terminal with no task and no permission', () => {
    expect(
      toCreateInput(
        { ...draft, where: 'folder', agent: 'shell' },
        { prompt: '', attachmentIds: [] },
      ),
    ).toEqual({
      hostId: 'host-1',
      agent: 'shell',
      folder: '/home/jordi/notes',
      launch: { model: null },
    });
  });

  it('sends nothing without a host or a place', () => {
    expect(toCreateInput({ ...draft, hostId: null }, extras)).toBeNull();
    expect(toCreateInput({ ...draft, where: 'folder', folder: null }, extras)).toBeNull();
    expect(toCreateInput({ ...draft, scope: [] }, extras)).toBeNull();
  });
});

describe('hasPlace', () => {
  it('asks a folder session for its folder and a worktree session for a repository', () => {
    expect(hasPlace({ where: 'folder', scope: [], folder: '/srv' })).toBe(true);
    expect(hasPlace({ where: 'folder', scope: draft.scope, folder: null })).toBe(false);
    expect(hasPlace({ where: 'worktree', scope: [], folder: '/srv' })).toBe(false);
  });
});

/**
 * A cloud session is the vendor's agent on one repository with a task: no
 * host, folder or launch level goes with it, and it is never sent as a host
 * session.
 */
describe('toStartCloudInput', () => {
  const cloud = { ...draft, where: 'cloud' as const, cloudModel: 'grok-4.7' };

  it('sends the vendor, the repository, the task and the model, and no host', () => {
    expect(toStartCloudInput({ ...cloud, projectId: 'project-1' }, 'Fix it')).toEqual({
      provider: 'cursor',
      projectId: 'project-1',
      checkout: { installationId: 'installation-1', githubRepoId: 42, baseBranch: 'main' },
      prompt: 'Fix it',
      model: 'grok-4.7',
    });
    expect(toCreateInput(cloud, extras)).toBeNull();
  });

  it('leaves the model to the vendor when its own default is picked', () => {
    expect(toStartCloudInput({ ...cloud, cloudModel: null }, 'Fix it')).not.toHaveProperty('model');
  });

  it('sends nothing without a task or a repository, or from a host', () => {
    expect(toStartCloudInput(cloud, '  ')).toBeNull();
    expect(toStartCloudInput({ ...cloud, scope: [] }, 'Fix it')).toBeNull();
    expect(toStartCloudInput(draft, 'Fix it')).toBeNull();
  });
});
