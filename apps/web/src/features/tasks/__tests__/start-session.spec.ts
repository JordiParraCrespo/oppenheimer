import { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { type StartSessionValues, toStartSession } from '../lib/start-session';

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

function values(overrides: Partial<StartSessionValues> = {}): StartSessionValues {
  return {
    prompt: 'Fix the login',
    repositoryId: 'r-1',
    place: 'host',
    hostId: 'h-1',
    agent: 'codex',
    model: null,
    ...overrides,
  };
}

const checkout = { installationId: 'i-1', githubRepoId: 101, baseBranch: 'main' };

describe('the body Start session sends', () => {
  it('starts the picked agent on the host with full permission', () => {
    expect(toStartSession(values(), project)).toEqual({
      session: {
        hostId: 'h-1',
        agent: 'codex',
        checkouts: [checkout],
        cwdGithubRepoId: 101,
        launch: { model: null, permission: 'full' },
        prompt: 'Fix the login',
      },
    });
  });

  it('starts Claude Code in its cloud from the host, with no permission level', () => {
    const body = toStartSession(values({ place: 'claude-cloud' }), project);
    expect(body).toMatchObject({ session: { agent: 'claude-code', cloud: true, hostId: 'h-1' } });
    expect(body).not.toHaveProperty('session.launch.permission');
  });

  it('launches Cursor with no host, on the repository’s base branch', () => {
    expect(toStartSession(values({ place: 'cursor', model: 'gpt-5' }), project)).toEqual({
      cloud: { provider: 'cursor', checkout, prompt: 'Fix the login', model: 'gpt-5' },
    });
  });

  it('sends nothing to the cloud without a task, and a host session with none', () => {
    expect(toStartSession(values({ place: 'cursor', prompt: ' ' }), project)).toBeNull();
    expect(toStartSession(values({ place: 'claude-cloud', prompt: '' }), project)).toBeNull();
    expect(toStartSession(values({ prompt: '' }), project)).toMatchObject({
      session: { prompt: undefined },
    });
  });
});
