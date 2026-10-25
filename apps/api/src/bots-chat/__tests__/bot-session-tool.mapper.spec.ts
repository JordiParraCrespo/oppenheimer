import type { ProjectEntity } from '../../projects/domain/project.entity';
import { planSession } from '../bot-session-tool.mapper';

/**
 * How `start_session` decides what to start, before anything is dispatched:
 * the host falls back from the one named to the project's default to the
 * home host, the repository to the project's default, and a missing or
 * wrong part comes back as the sentence the model needs. The dispatch is
 * the session tools' spec.
 */
const HOME = '11111111-1111-4111-8111-111111111111';
const PROJECT_HOST = '22222222-2222-4222-8222-222222222222';
const project = (overrides: Partial<Record<string, unknown>> = {}) =>
  ({
    id: '33333333-3333-4333-8333-333333333333',
    defaultHostId: null,
    defaultAgent: null,
    repositories: [
      {
        installationId: '44444444-4444-4444-8444-444444444444',
        githubRepoId: '42',
        repositoryFullName: 'acme/app',
        baseBranch: 'main',
        isDefault: true,
      },
    ],
    ...overrides,
  }) as unknown as ProjectEntity;

describe('planSession', () => {
  it('runs on the project’s default host before the home host, in its default repository', () => {
    const plan = planSession({ task: 'Fix it' }, project({ defaultHostId: PROJECT_HOST }), HOME);
    expect(plan).toMatchObject({
      hostId: PROJECT_HOST,
      body: { checkouts: [{ githubRepoId: 42, baseBranch: 'main' }], prompt: 'Fix it' },
    });
  });

  it('falls back to the home host, and starts Claude Code unless told otherwise', () => {
    expect(planSession({ task: 'Fix it' }, project(), HOME)).toMatchObject({
      hostId: HOME,
      body: { agent: 'claude-code' },
    });
  });

  // Nobody sits at a bot's terminal: left to the API's default (`ask`), the
  // agent would wait on its first approval forever.
  it('starts every session at auto, in a worktree or a folder', () => {
    expect(planSession({ task: 'Fix it' }, project(), HOME)).toMatchObject({
      body: { launch: { permission: 'auto' } },
    });
    expect(planSession({ task: 'Fix it', folder: '/srv/app' }, null, HOME)).toMatchObject({
      body: { launch: { permission: 'auto' } },
    });
  });

  it('asks for a project or a folder, and for a host when there is no default', () => {
    expect(planSession({ task: 'x' }, null, HOME)).toEqual({
      refusal: 'Give a project_id (to work in one of its repositories) or a folder on the host.',
    });
    expect(planSession({ task: 'x', folder: '/srv/app' }, null, null)).toMatchObject({
      refusal: expect.stringContaining('Ask which host to use'),
    });
  });

  it('names the project’s repositories when the one asked for is not among them', () => {
    expect(planSession({ task: 'x', repository: 'acme/other' }, project(), HOME)).toEqual({
      refusal: 'The project has no repository acme/other. Its repositories: acme/app.',
    });
  });

  it('refuses a session the sessions’ schema would refuse, naming the field', () => {
    expect(planSession({ task: 'x', folder: 'relative/path' }, null, HOME)).toMatchObject({
      refusal: expect.stringContaining('folder'),
    });
  });

  it('names a rejected prompt as the tool’s task, the field the model wrote', () => {
    expect(planSession({ task: 'a'.repeat(5_000) }, project(), HOME)).toMatchObject({
      refusal: expect.stringContaining('(task)'),
    });
  });
});
