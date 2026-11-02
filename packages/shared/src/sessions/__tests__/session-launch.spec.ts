import { describe, expect, it } from 'vitest';
import { pickProjectCheckout, sessionLaunchBody } from '../session-launch.js';

/**
 * `opp` and the MCP server both turn "this task, in this project's repository,
 * on that host" into `POST /sessions`. The body and its defaults are decided
 * here once, so the two clients cannot start agents differently.
 */

const REPOSITORIES = [
  {
    installationId: 'i-1',
    githubRepoId: '11',
    repositoryFullName: 'acme/web',
    baseBranch: 'main',
    isDefault: false,
  },
  {
    installationId: 'i-1',
    githubRepoId: '22',
    repositoryFullName: 'acme/api',
    baseBranch: 'trunk',
    isDefault: true,
  },
];

describe('pickProjectCheckout', () => {
  it('picks the default repository when none is named, with GitHub’s id as a number', () => {
    expect(pickProjectCheckout(REPOSITORIES)).toEqual({
      installationId: 'i-1',
      githubRepoId: 22,
      baseBranch: 'trunk',
      fullName: 'acme/api',
    });
  });

  it('picks the named one whatever its case, and answers null for one the project lacks', () => {
    expect(pickProjectCheckout(REPOSITORIES, 'ACME/web')?.githubRepoId).toBe(11);
    expect(pickProjectCheckout(REPOSITORIES, 'acme/docs')).toBeNull();
  });
});

describe('sessionLaunchBody', () => {
  it('starts the agent in its one checkout, with the task as the first prompt', () => {
    const checkout = pickProjectCheckout(REPOSITORIES) ?? undefined;
    expect(sessionLaunchBody({ hostId: 'h', task: 'fix it', checkout, projectId: 'p' })).toEqual({
      hostId: 'h',
      agent: 'claude-code',
      projectId: 'p',
      name: undefined,
      prompt: 'fix it',
      checkouts: [{ installationId: 'i-1', githubRepoId: 22, baseBranch: 'trunk' }],
      cwdGithubRepoId: 22,
    });
  });

  it('sends a launch only when one was asked for, so the API’s safe default holds otherwise', () => {
    const folder = sessionLaunchBody({ hostId: 'h', task: 't', folder: '/srv/app' });
    expect(folder).not.toHaveProperty('launch');
    expect(folder.folder).toBe('/srv/app');
    expect(
      sessionLaunchBody({ hostId: 'h', task: 't', folder: '/srv', permission: 'auto' }).launch,
    ).toEqual({ permission: 'auto', model: undefined });
  });
});
