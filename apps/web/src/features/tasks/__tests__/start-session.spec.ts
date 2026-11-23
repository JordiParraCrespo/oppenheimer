import { ProjectEntity, RepositoryEntity } from '@oppenheimer/frontend-consumer';
import { HOST_HOME } from '@oppenheimer/frontend-consumer/react';
import { DEFAULT_SESSION_PERMISSION } from '@oppenheimer/shared/agents';
import { describe, expect, it } from 'vitest';
import {
  type StartSessionValues,
  startReadiness,
  startRepositories,
  toStartSession,
} from '../lib/start-session';

/**
 * What Start session sends for each place: New session's body on a host, the
 * same body with `cloud: true` from a host into Claude Code's cloud, and a
 * vendor's launch with no host. A cloud session starts on a task.
 */
const project = new ProjectEntity(
  'p-1',
  'Mobile',
  'mobile',
  false,
  'h-1',
  'codex',
  [
    {
      id: 'r-1',
      installationId: 'i-1',
      githubRepoId: '101',
      fullName: 'acme/mobile',
      isDefault: true,
      baseBranch: 'main',
    },
  ],
  new Date(),
  new Date(),
);

const repositories = startRepositories(project, []);

function values(overrides: Partial<StartSessionValues> = {}): StartSessionValues {
  return {
    prompt: 'Fix the login',
    repository: 'i-1:101',
    place: 'host',
    hostId: 'h-1',
    agent: 'codex',
    model: null,
    ...overrides,
  };
}

const checkout = { installationId: 'i-1', githubRepoId: 101, baseBranch: 'main' };

describe('the body Start session sends', () => {
  it('starts the picked agent on the host in auto mode, never bypassing permissions', () => {
    expect(DEFAULT_SESSION_PERMISSION).toBe('auto');
    expect(toStartSession(values(), repositories)).toEqual({
      session: {
        hostId: 'h-1',
        agent: 'codex',
        checkouts: [checkout],
        cwdGithubRepoId: 101,
        launch: { model: null, permission: DEFAULT_SESSION_PERMISSION },
        prompt: 'Fix the login',
      },
    });
  });

  it('starts Claude Code in its cloud from the host, with no permission level', () => {
    const body = toStartSession(values({ place: 'claude-cloud' }), repositories);
    expect(body).toMatchObject({ session: { agent: 'claude-code', cloud: true, hostId: 'h-1' } });
    expect(body).not.toHaveProperty('session.launch.permission');
  });

  it('launches Cursor with no host, on the repository’s base branch', () => {
    expect(toStartSession(values({ place: 'cursor', model: 'gpt-5' }), repositories)).toEqual({
      cloud: { provider: 'cursor', checkout, prompt: 'Fix the login', model: 'gpt-5' },
    });
  });

  it('sends nothing to the cloud without a task, and a host session with none', () => {
    expect(toStartSession(values({ place: 'cursor', prompt: ' ' }), repositories)).toBeNull();
    expect(toStartSession(values({ place: 'claude-cloud', prompt: '' }), repositories)).toBeNull();
    expect(toStartSession(values({ prompt: '' }), repositories)).toMatchObject({
      session: { prompt: undefined },
    });
  });

  it('opens a session with no repository in the host’s home, never in the cloud', () => {
    const none = values({ repository: null });
    expect(toStartSession(none, repositories)).toEqual({
      session: {
        hostId: 'h-1',
        agent: 'codex',
        folder: HOST_HOME,
        launch: { model: null, permission: DEFAULT_SESSION_PERMISSION },
        prompt: 'Fix the login',
      },
    });
    expect(toStartSession({ ...none, place: 'claude-cloud' }, repositories)).toBeNull();
    expect(toStartSession({ ...none, place: 'cursor' }, repositories)).toBeNull();
  });
});

describe('the repositories Start session offers', () => {
  const reachable = [
    {
      installationId: 'i-1',
      repository: new RepositoryEntity(101, 'mobile', 'acme/mobile', 'develop', true, false, null),
    },
    {
      installationId: 'i-1',
      repository: new RepositoryEntity(202, 'web', 'acme/web', 'trunk', true, false, null),
    },
    {
      installationId: 'i-2',
      repository: new RepositoryEntity(303, 'api', 'beta/api', 'main', true, false, null),
    },
  ];

  it('lists the project’s repositories first, then every other one the workspace reaches, once', () => {
    expect(
      startRepositories(project, reachable).map((row) => [row.key, row.baseBranch, row.inProject]),
    ).toEqual([
      ['i-1:101', 'main', true],
      ['i-1:202', 'trunk', false],
      ['i-2:303', 'main', false],
    ]);
  });

  it('starts from a repository outside the project, on its default branch', () => {
    const bare = new ProjectEntity(
      'p-2',
      'Bare',
      'bare',
      false,
      null,
      'codex',
      [],
      new Date(),
      new Date(),
    );
    expect(
      toStartSession(values({ repository: 'i-2:303' }), startRepositories(bare, reachable)),
    ).toMatchObject({
      session: {
        checkouts: [{ installationId: 'i-2', githubRepoId: 303, baseBranch: 'main' }],
        cwdGithubRepoId: 303,
      },
    });
  });
});

describe('whether Start session can start', () => {
  const ready = {
    place: 'host' as const,
    promptEmpty: false,
    noRepository: false,
    hasHosts: true,
    hostOnline: true,
  };

  it('queues a session for an offline host, but holds one with no repository, whose home only the host can say', () => {
    expect(startReadiness({ ...ready, hostOnline: false })).toEqual({ hold: null, queues: true });
    expect(startReadiness({ ...ready, hostOnline: false, noRepository: true })).toEqual({
      hold: 'home',
      queues: false,
    });
    expect(startReadiness({ ...ready, noRepository: true })).toEqual({ hold: null, queues: false });
  });

  it('holds a cloud start without a task or a repository, and any start with no host to run it', () => {
    expect(startReadiness({ ...ready, place: 'cursor', promptEmpty: true }).hold).toBe('task');
    expect(startReadiness({ ...ready, place: 'claude-cloud', noRepository: true }).hold).toBe(
      'repository',
    );
    expect(startReadiness({ ...ready, hasHosts: false }).hold).toBe('host');
    expect(startReadiness({ ...ready, place: 'cursor', hasHosts: false }).hold).toBeNull();
  });
});
