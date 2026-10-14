import { describe, expect, it } from 'vitest';
import type { NewSessionDraft } from '../lib/new-session-draft';
import { hasPlace, toCreateInput } from '../lib/session-options';

/**
 * What New session posts for each place (`product/versions/mvp/24-session-places.md`):
 * a folder and no checkouts, or one checkout and no folder — never both, and
 * nothing while the draft names no place.
 */
const draft: NewSessionDraft = {
  where: 'worktree',
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
