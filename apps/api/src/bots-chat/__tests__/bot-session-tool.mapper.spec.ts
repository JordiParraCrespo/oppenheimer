import type { ProjectEntity } from '../../projects/domain/project.entity';
import { planSession, sentTurnOf, sessionSummary } from '../bot-session-tool.mapper';

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

  // What breaks this: a bot asked to start work in the background whose
  // session still lands in the person's sidebar.
  it('starts the session hidden when the bot asks, and shown otherwise', () => {
    expect(planSession({ task: 'Fix it', hidden: true }, project(), HOME)).toMatchObject({
      body: { hidden: true },
    });
    const shown = planSession({ task: 'Fix it' }, project(), HOME);
    expect('body' in shown && shown.body.hidden).toBeFalsy();
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

  // What breaks this: a bot that answers "I can't choose the model when I
  // start a session" because its session never carries the person's choice.
  it('launches on the model, effort and permission the person named, from the branch they named', () => {
    const plan = planSession(
      {
        task: 'Fix it',
        model: 'Opus 5.5',
        effort: 'high',
        permission: 'full',
        base_branch: 'develop',
      },
      project(),
      HOME,
    );
    expect(plan).toMatchObject({
      body: {
        agent: 'claude-code',
        launch: { model: 'claude-opus-5-5', effort: 'high', permission: 'full' },
        checkouts: [{ githubRepoId: 42, baseBranch: 'develop' }],
      },
    });
  });

  it('checks the model against the agent the session runs, the project’s default included', () => {
    expect(
      planSession({ task: 'x', model: 'GPT-6.1 Sol' }, project({ defaultAgent: 'codex' }), HOME),
    ).toMatchObject({ body: { agent: 'codex', launch: { model: 'gpt-6.1-sol' } } });
    expect(planSession({ task: 'x', model: 'GPT-6.1 Sol' }, project(), HOME)).toMatchObject({
      refusal: expect.stringContaining('Claude Code has no model "GPT-6.1 Sol"'),
    });
  });

  it('refuses a base branch for a folder session, which checks nothing out', () => {
    expect(
      planSession({ task: 'x', folder: '/srv/app', base_branch: 'develop' }, null, HOME),
    ).toMatchObject({ refusal: expect.stringContaining('base_branch') });
  });

  it('names a rejected prompt as the tool’s task, the field the model wrote', () => {
    expect(planSession({ task: 'a'.repeat(5_000) }, project(), HOME)).toMatchObject({
      refusal: expect.stringContaining('(task)'),
    });
  });
});

describe('sessionSummary', () => {
  // What breaks this: a card that asks for a yes without saying the session
  // runs with full access, or on which model.
  it('names the launch the person is approving, and only what they chose', () => {
    expect(
      sessionSummary(
        {
          task: 'Fix it',
          model: 'opus 5.5',
          effort: 'high',
          permission: 'full',
          base_branch: 'develop',
        },
        project(),
        'build-02',
      ),
    ).toBe(
      'Start Claude Code (Opus 5.5, high effort, full access) on build-02 in acme/app from develop, and hear back when it ends: Fix it',
    );
    expect(sessionSummary({ task: 'Fix it' }, project(), 'build-02')).toBe(
      'Start Claude Code on build-02 in acme/app, and hear back when it ends: Fix it',
    );
  });
});

describe('sentTurnOf', () => {
  // What breaks this: send_to_session watching a task its prompt did not
  // open, so the bot waits for a wake that never comes.
  it('is the next task after a finished one, the live one it joins, or the first', () => {
    expect(sentTurnOf({ seq: 2, state: 'completed' })).toBe(3);
    expect(sentTurnOf({ seq: 2, state: 'in_progress' })).toBe(2);
    expect(sentTurnOf(null)).toBe(1);
  });
});
