import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { FIELD_BOUNDS } from '@oppenheimer/shared';
import { FindHostQuery } from '../../../hosts/queries/find-host/find-host.query';
import { AnswerSessionDecisionCommand } from '../../../sessions/commands/answer-session-decision/answer-session-decision.command';
import { CloseSessionCommand } from '../../../sessions/commands/close-session/close-session.command';
import { CreateSessionCommand } from '../../../sessions/commands/create-session/create-session.command';
import { SendSessionPromptCommand } from '../../../sessions/commands/send-session-prompt/send-session-prompt.command';
import { StartCloudSessionCommand } from '../../../sessions/commands/start-cloud-session/start-cloud-session.command';
import { StopSessionCommand } from '../../../sessions/commands/stop-session/stop-session.command';
import { SessionCloudRunEntity } from '../../../sessions/domain/session-cloud-run.entity';
import { SESSION_EVENT_KINDS } from '../../../sessions/domain/session-state.policy';
import type { SessionTurnFold } from '../../../sessions/domain/session-turn.policy';
import { WorkSessionEntity } from '../../../sessions/domain/work-session.entity';
import { FindSessionQuery } from '../../../sessions/queries/find-session/find-session.query';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import { BotSessionToolsFactory } from '../bot-session-tools.factory';
import { BotSessionWaitResolver } from '../bot-session-wait.resolver';
import type { BotSessionWatchResolver } from '../bot-session-watch.resolver';
import type { BotToolContext } from '../bot-tool.factory';

/**
 * Starting, prompting, answering and stopping sessions reach the owner's
 * machines, so they ask:
 * under Approve for me nothing is dispatched, a card is raised that names the
 * agent, the host, the repository and the task, and the model is told;
 * under Full access the sessions' own commands run in the owner's scope,
 * the session marked as the bot's, and the same call in the same turn
 * starts one session. The commands themselves are the sessions module's.
 */
const owner = emptyScope('owner-1', 'org-1');
const HOME = '11111111-1111-4111-8111-111111111111';
const PROJECT = '22222222-2222-4222-8222-222222222222';
const INSTALLATION = '44444444-4444-4444-8444-444444444444';

const context = (
  permission: BotToolContext['permission'],
  approvals: BotApprovalRequesterPort,
): BotToolContext => ({
  owner,
  organizationId: 'org-1',
  botId: 'bot-1',
  turnId: 'turn-1',
  homeHostId: HOME,
  timeZone: 'UTC',
  permission,
  permissions: NO_PERMISSIONS,
  approvals,
  budget: new BotTurnBudget(),
});

const project = {
  id: PROJECT,
  name: 'XRP Mobile',
  defaultHostId: null,
  defaultAgent: null,
  repositories: [
    {
      installationId: INSTALLATION,
      githubRepoId: '42',
      repositoryFullName: 'acme/xrp-mobile',
      baseBranch: 'main',
      isDefault: true,
    },
  ],
};

/** A running session whose agent waits on a permission dialog. */
function blockedSession(): WorkSessionEntity {
  const session = WorkSessionEntity.request({
    organizationId: 'org-1',
    projectId: PROJECT,
    createdByUserId: 'owner-1',
    hostId: HOME,
    slug: 'swift-wren-7gyezw',
    agent: 'claude-code',
  });
  const at = new Date();
  session.recordEvents([
    { seq: 1, kind: SESSION_EVENT_KINDS.STARTED, payload: {}, occurredAt: at },
    { seq: 2, kind: SESSION_EVENT_KINDS.NAMED, payload: { name: 'Fix login' }, occurredAt: at },
    {
      seq: 3,
      kind: SESSION_EVENT_KINDS.AGENT_DECISION,
      payload: {
        decision: {
          kind: 'permission',
          id: 'perm-1',
          title: 'Do you want to proceed?',
          detail: 'pnpm test',
          options: [{ label: 'Yes' }, { label: 'No' }],
        },
      },
      occurredAt: at,
    },
  ]);
  return session;
}

/** A running session whose agent asks to delete a folder recursively. */
function destructiveSession(): WorkSessionEntity {
  const session = blockedSession();
  session.recordEvent({
    seq: 4,
    kind: SESSION_EVENT_KINDS.AGENT_DECISION,
    payload: {
      decision: {
        kind: 'permission',
        id: 'perm-2',
        title: 'Do you want to proceed?',
        detail: 'Bash command\n  rm -rf ./node_modules ../shared',
        options: [
          { label: 'Yes' },
          { label: "Yes, and don't ask again for rm commands" },
          { label: 'No, and tell Claude what to do differently (esc)' },
        ],
      },
    },
    occurredAt: new Date(),
  });
  return session;
}

/** A session a bot started whose host could not start it. */
function failedBotSession(): WorkSessionEntity {
  const session = WorkSessionEntity.request({
    organizationId: 'org-1',
    projectId: PROJECT,
    createdByUserId: 'owner-1',
    hostId: HOME,
    slug: 'grey-finch-4m2p8x',
    agent: 'claude-code',
    name: 'Bump deps',
    origin: 'bot',
  });
  session.recordEvent({
    seq: 1,
    kind: SESSION_EVENT_KINDS.FAILED,
    payload: { reason: 'worktree_failed' },
    occurredAt: new Date(),
  });
  return session;
}

/** A session Cursor launched on the owner's key, its agent's page at Cursor. */
function cursorSession(): WorkSessionEntity {
  return WorkSessionEntity.requestCloud({
    id: 'session-1',
    cloudRun: SessionCloudRunEntity.launched(
      {
        organizationId: 'org-1',
        sessionId: 'session-1',
        provider: 'cursor',
        externalId: 'bc-session-1',
        url: 'https://cursor.com/agents?id=bc-session-1',
        repositoryUrl: 'https://github.com/acme/xrp-mobile',
        run: {
          runId: 'run-1',
          status: 'starting',
          branch: null,
          pullRequestUrl: null,
          summary: null,
        },
      },
      new Date(),
    ),
    organizationId: 'org-1',
    projectId: PROJECT,
    createdByUserId: 'owner-1',
    slug: 'calm-heron-2k8d4q',
    agent: 'cursor',
  });
}

/** A cloud session its host has started, or not yet when `cloudSessionId` is null. */
function cloudSession(
  cloudSessionId: string | null,
  agent: 'claude-code' | 'codex' = 'claude-code',
  origin: 'person' | 'bot' = 'person',
): WorkSessionEntity {
  const session = WorkSessionEntity.request({
    organizationId: 'org-1',
    projectId: PROJECT,
    createdByUserId: 'owner-1',
    hostId: HOME,
    slug: 'bold-otter-3f9a7k',
    agent,
    place: 'cloud',
    origin,
  });
  if (cloudSessionId) {
    session.recordEvent({
      seq: 1,
      kind: SESSION_EVENT_KINDS.STARTED,
      payload: { agentSessionId: cloudSessionId, checkouts: [] },
      occurredAt: new Date(),
    });
  }
  return session;
}

function setup(permission: BotToolContext['permission']) {
  const session = blockedSession();
  const queryBus = {
    execute: vi.fn(async (query: unknown) => {
      if (query instanceof FindHostQuery) return { host: { name: 'build-02' }, online: true };
      if (query instanceof FindSessionQuery) return session;
      return project;
    }),
  };
  const approvals = {
    request: vi.fn<BotApprovalRequesterPort['request']>(async () => ({
      status: 'requested',
      approvalId: 'approval-1',
    })),
  };
  const commandBus = {
    // A prompt or an answer comes back with the log entry it was recorded as.
    execute: vi.fn(async () => ({ sessionId: 'session-1', hints: [] as string[], seq: 7 })),
  };
  const watches = {
    follow: vi.fn<BotSessionWatchResolver['follow']>(async (_context, _sessionId, from, watch) =>
      watch === false
        ? 'You are not watching it.'
        : from === 'first_task'
          ? 'You are subscribed to it.'
          : 'You follow its task.',
    ),
  };
  const factory = new BotSessionToolsFactory(
    queryBus as unknown as QueryBus,
    commandBus as unknown as CommandBus,
    watches as unknown as BotSessionWatchResolver,
    new BotSessionWaitResolver(queryBus as unknown as QueryBus),
  );
  const call = (name: string, input: unknown) => {
    const definition = factory.definitions().find((candidate) => candidate.name === name);
    if (!definition) throw new Error(`no tool ${name}`);
    return definition
      .bind(context(permission, approvals))
      .run(input, { signal: new AbortController().signal });
  };
  return { queryBus, commandBus, approvals, watches, call, session };
}

describe('BotSessionToolsFactory', () => {
  it('asks first under Approve for me: a card naming the agent, host, repository and task, nothing started', async () => {
    const { commandBus, approvals, call } = setup('auto');
    const result = await call('start_session', { task: 'Fix the test', project_id: PROJECT });
    expect(approvals.request).toHaveBeenCalledWith({
      organizationId: 'org-1',
      botId: 'bot-1',
      turnId: 'turn-1',
      tool: 'start_session',
      input: { task: 'Fix the test', project_id: PROJECT },
      summary:
        'Start Claude Code on build-02 in acme/xrp-mobile, and hear back when it ends: Fix the test',
      subject: { kind: 'project', key: PROJECT, label: 'XRP Mobile' },
      sharesOutside: false,
      perCallOnly: false,
      reviewNote: null,
    });
    expect(result.content).toContain('End your turn now');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('still names a project the owner cannot read on the card, by its id', async () => {
    const { queryBus, approvals, call } = setup('auto');
    queryBus.execute.mockImplementation(async (query: unknown) => {
      if (query instanceof FindHostQuery) return { host: { name: 'build-02' }, online: true };
      throw new Error('PROJECTS_001');
    });
    await call('start_session', { task: 'Upgrade', project_id: PROJECT });
    expect(approvals.request.mock.calls[0][0].summary).toBe(
      `Start Claude Code on build-02 in project ${PROJECT}, and hear back when it ends: Upgrade`,
    );
  });

  it('starts the agent in the project’s default repository on the home host, as the owner, marked as the bot’s', async () => {
    const { commandBus, call } = setup('full');
    const result = await call('start_session', {
      task: 'Fix the failing test',
      project_id: PROJECT,
    });
    const command = commandBus.execute.mock.calls[0][0] as CreateSessionCommand;
    expect(command).toBeInstanceOf(CreateSessionCommand);
    expect(command).toMatchObject({ scope: owner, userId: 'owner-1', origin: 'bot' });
    expect(command.input).toMatchObject({
      hostId: HOME,
      agent: 'claude-code',
      projectId: PROJECT,
      prompt: 'Fix the failing test',
      checkouts: [{ installationId: INSTALLATION, githubRepoId: 42, baseBranch: 'main' }],
      cwdGithubRepoId: 42,
    });
    expect(command.idempotencyKey).toMatch(/^bot:turn-1:[0-9a-f]{32}$/);
    expect(result.content).toContain('Started session session-1');
    // The chat links to the session from this, not from the words.
    expect(result.data).toEqual({ sessionId: 'session-1' });
  });

  it('subscribes the bot to the session it started, and says so in its answer', async () => {
    const { watches, call } = setup('full');
    const result = await call('start_session', { task: 'Research', project_id: PROJECT });
    expect(watches.follow).toHaveBeenCalledWith(
      expect.objectContaining({ turnId: 'turn-1' }),
      'session-1',
      'first_task',
      undefined,
    );
    expect(result.content).toContain('You are subscribed to it.');
  });

  it('starts without a watch when asked not to', async () => {
    const { watches, call } = setup('full');
    const unwatched = await call('start_session', { task: 'A', project_id: PROJECT, watch: false });
    expect(watches.follow).toHaveBeenCalledWith(
      expect.anything(),
      'session-1',
      'first_task',
      false,
    );
    expect(unwatched.content).toContain('You are not watching it');
  });

  it('gives the same call in the same turn the same idempotency key', async () => {
    const { commandBus, call } = setup('full');
    await call('start_session', { task: 'Same', project_id: PROJECT });
    await call('start_session', { task: 'Same', project_id: PROJECT });
    const [first, second] = commandBus.execute.mock.calls.map(
      ([command]) => (command as CreateSessionCommand).idempotencyKey,
    );
    expect(first).toBe(second);
  });

  it('refuses a repository the project does not hold, as an error naming the ones it does, starting nothing', async () => {
    const { commandBus, call } = setup('full');
    const result = await call('start_session', {
      task: 'x',
      project_id: PROJECT,
      repository: 'acme/other',
    });
    expect(result.content).toContain('The project has no repository acme/other');
    expect(result.content).toContain('acme/xrp-mobile');
    // An error, so an approved call that refuses ends failed rather than approved.
    expect(result.isError).toBe(true);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  // A bot once told its owner "I can't choose the model when I start a
  // session": the tool took no model, so every session ran the host's default.
  it('launches on the model, effort, permission and base branch the person named, the card saying so', async () => {
    const asked = setup('auto');
    await asked.call('start_session', {
      task: 'Fix the test',
      project_id: PROJECT,
      model: 'Opus 5.5',
      effort: 'high',
      permission: 'full',
      base_branch: 'develop',
    });
    expect(asked.approvals.request.mock.calls[0][0].summary).toBe(
      'Start Claude Code (Opus 5.5, high effort, full access) on build-02 in acme/xrp-mobile from develop, and hear back when it ends: Fix the test',
    );

    const { commandBus, call } = setup('full');
    await call('start_session', {
      task: 'Fix the test',
      project_id: PROJECT,
      model: 'Opus 5.5',
      effort: 'high',
      permission: 'ask',
      base_branch: 'develop',
    });
    const command = commandBus.execute.mock.calls[0][0] as CreateSessionCommand;
    expect(command.input).toMatchObject({
      launch: { model: 'claude-opus-5-5', effort: 'high', permission: 'ask' },
      checkouts: [{ githubRepoId: 42, baseBranch: 'develop' }],
    });
  });

  // What breaks this: a grant given for sessions at approve for me, or the
  // Full access preset, starting an agent with every check off unseen.
  it('asks for a session at full access on a card of its own, offering only this call, under Full access too', async () => {
    const { commandBus, approvals, call } = setup('full');
    await call('start_session', { task: 'x', project_id: PROJECT, permission: 'full' });
    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({ tool: 'start_session', perCallOnly: true }),
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('refuses a model the agent does not have before any card, naming the ones it has', async () => {
    const { commandBus, approvals, call } = setup('auto');
    const result = await call('start_session', {
      task: 'x',
      project_id: PROJECT,
      model: 'gpt-6.1-sol',
    });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Opus 5.5 (claude-opus-5-5, default)');
    expect(approvals.request).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  // The tool once took 20,000 characters while a session's first prompt holds
  // 2 KiB: a long brief got a card, then failed as "invalid (prompt)".
  describe('the task bound is the session prompt’s', () => {
    const max = FIELD_BOUNDS.prompt.maxBytes;

    it('starts a session with the longest task the tool accepts, in multibyte text too', async () => {
      const { commandBus, call } = setup('full');
      for (const task of ['a'.repeat(max), '€'.repeat(Math.floor(max / 3))]) {
        const result = await call('start_session', { task, project_id: PROJECT });
        expect(result.isError).toBeFalsy();
      }
      expect(commandBus.execute).toHaveBeenCalledTimes(2);
    });

    it('refuses a task one byte over as its own input error, before a card or a session', async () => {
      for (const permission of ['auto', 'full'] as const) {
        const { commandBus, approvals, call } = setup(permission);
        const result = await call('start_session', {
          task: `${'a'.repeat(max - 2)}€`,
          project_id: PROJECT,
        });
        expect(result.isError).toBe(true);
        expect(result.content).toContain(`task: Too long: at most ${max} bytes`);
        expect(approvals.request).not.toHaveBeenCalled();
        expect(commandBus.execute).not.toHaveBeenCalled();
      }
    });
  });

  it('says it is queued when the host is offline', async () => {
    const { commandBus, call } = setup('full');
    commandBus.execute.mockResolvedValueOnce({ sessionId: 'session-2', hints: ['host_offline'] });
    const result = await call('start_session', { task: 'x', folder: '/srv/app' });
    expect(result.content).toContain('The host is offline: the session is queued');
  });

  describe('start_cloud_session', () => {
    const CLOUD_ID = 'session_014a8EH8DJs95X1iK8ZH9Y82';

    /** The session the create made, as the owner reads it back. */
    function readsBack(queryBus: ReturnType<typeof setup>['queryBus'], session: WorkSessionEntity) {
      queryBus.execute.mockImplementation(async (query: unknown) => {
        if (query instanceof FindHostQuery) return { host: { name: 'build-02' }, online: true };
        if (query instanceof FindSessionQuery) return session;
        return project;
      });
    }

    it('asks first under Approve for me, the card naming the cloud, the host, the repository and the task', async () => {
      const { commandBus, approvals, call } = setup('auto');
      await call('start_cloud_session', { task: 'Fix the test', project_id: PROJECT });
      expect(approvals.request.mock.calls[0][0]).toMatchObject({
        tool: 'start_cloud_session',
        summary: 'Start a Claude Code cloud session from build-02 in acme/xrp-mobile: Fix the test',
        subject: { kind: 'project', key: PROJECT, label: 'XRP Mobile' },
      });
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('creates the session the console’s Claude Code cloud does, which has the host run claude --cloud, and returns its claude.ai URL', async () => {
      const { commandBus, queryBus, call } = setup('full');
      readsBack(queryBus, cloudSession(CLOUD_ID));
      const result = await call('start_cloud_session', {
        task: 'Fix the failing test',
        project_id: PROJECT,
      });
      const command = commandBus.execute.mock.calls[0][0] as CreateSessionCommand;
      expect(command).toBeInstanceOf(CreateSessionCommand);
      expect(command).toMatchObject({ scope: owner, userId: 'owner-1', origin: 'bot' });
      expect(command.input).toMatchObject({
        hostId: HOME,
        agent: 'claude-code',
        cloud: true,
        projectId: PROJECT,
        prompt: 'Fix the failing test',
        checkouts: [{ installationId: INSTALLATION, githubRepoId: 42, baseBranch: 'main' }],
      });
      expect(command.idempotencyKey).toMatch(/^bot:turn-1:[0-9a-f]{32}$/);
      expect(result.content).toContain(`https://claude.ai/code/${CLOUD_ID}`);
      expect(result.data).toEqual({ sessionId: 'session-1' });
    });

    // What breaks this: a bot that started a cloud session that failed to
    // start, was never woken, and told the person only once they asked.
    it('follows the cloud session it started, unless told not to watch', async () => {
      const { queryBus, watches, call } = setup('full');
      readsBack(queryBus, cloudSession(CLOUD_ID));
      const followed = await call('start_cloud_session', { task: 'x', project_id: PROJECT });
      expect(watches.follow).toHaveBeenCalledWith(
        expect.anything(),
        'session-1',
        'first_task',
        undefined,
      );
      expect(followed.content).toContain('You are subscribed to it.');

      watches.follow.mockClear();
      await call('start_cloud_session', { task: 'x', project_id: PROJECT, watch: false });
      expect(watches.follow).toHaveBeenCalledWith(
        expect.anything(),
        'session-1',
        'first_task',
        false,
      );
    });

    it('answers without a URL when the host has not named the session within the wait', async () => {
      const { queryBus, call } = setup('full');
      readsBack(queryBus, cloudSession(null));
      const result = await call('start_cloud_session', {
        task: 'x',
        project_id: PROJECT,
        wait_seconds: 0,
      });
      expect(result.isError).toBeFalsy();
      expect(result.content).toContain('has not named it yet');
      expect(result.content).not.toContain('claude.ai/code/');
    });

    it('does not wait on a host that is offline', async () => {
      const { commandBus, queryBus, call } = setup('full');
      commandBus.execute.mockResolvedValueOnce({ sessionId: 'session-2', hints: ['host_offline'] });
      const result = await call('start_cloud_session', { task: 'x', project_id: PROJECT });
      expect(result.content).toContain('is offline');
      expect(queryBus.execute).not.toHaveBeenCalledWith(expect.any(FindSessionQuery));
    });

    it('refuses a repository the project does not hold, starting nothing', async () => {
      const { commandBus, call } = setup('full');
      const result = await call('start_cloud_session', {
        task: 'x',
        project_id: PROJECT,
        repository: 'acme/other',
      });
      expect(result.isError).toBe(true);
      expect(result.content).toContain('The project has no repository acme/other');
      expect(commandBus.execute).not.toHaveBeenCalled();
    });
    it('starts Codex’s cloud the same way, from the host, in the environment named, and returns its chatgpt.com URL', async () => {
      const { commandBus, queryBus, call } = setup('full');
      readsBack(queryBus, cloudSession('task_e_6823abc', 'codex'));
      const result = await call('start_cloud_session', {
        task: 'Fix the failing test',
        project_id: PROJECT,
        agent: 'codex',
        codex_environment: 'acme-mobile',
      });
      const command = commandBus.execute.mock.calls[0][0] as CreateSessionCommand;
      expect(command).toBeInstanceOf(CreateSessionCommand);
      expect(command.input).toMatchObject({
        hostId: HOME,
        agent: 'codex',
        cloud: true,
        codexEnvironment: 'acme-mobile',
      });
      expect(result.content).toContain('https://chatgpt.com/codex/tasks/task_e_6823abc');
    });

    it('refuses a Codex environment for Claude Code, starting nothing', async () => {
      const { commandBus, call } = setup('full');
      const result = await call('start_cloud_session', {
        task: 'x',
        project_id: PROJECT,
        codex_environment: 'acme-mobile',
      });
      expect(result.isError).toBe(true);
      expect(result.content).toContain(
        'codex_environment is only for codex; leave it out for claude-code.',
      );
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('asks first for Cursor, the card naming no host and the owner’s Cursor key it bills', async () => {
      const { commandBus, approvals, queryBus, call } = setup('auto');
      await call('start_cloud_session', {
        task: 'Fix the test',
        project_id: PROJECT,
        agent: 'cursor',
        model: 'grok-4.7',
      });
      expect(approvals.request.mock.calls[0][0]).toMatchObject({
        tool: 'start_cloud_session',
        summary:
          'Start a Cursor cloud session in acme/xrp-mobile, on your Cursor key, model grok-4.7: Fix the test',
      });
      expect(queryBus.execute).not.toHaveBeenCalledWith(expect.any(FindHostQuery));
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('launches Cursor through the sessions’ own cloud command, with no host, and returns its Cursor URL', async () => {
      const { commandBus, queryBus, call } = setup('full');
      readsBack(queryBus, cursorSession());
      const result = await call('start_cloud_session', {
        task: 'Fix the failing test',
        project_id: PROJECT,
        agent: 'cursor',
        model: 'grok-4.7',
      });
      const command = commandBus.execute.mock.calls[0][0] as StartCloudSessionCommand;
      expect(command).toBeInstanceOf(StartCloudSessionCommand);
      expect(command).toMatchObject({ scope: owner, userId: 'owner-1', origin: 'bot' });
      expect(command.input).toEqual({
        provider: 'cursor',
        projectId: PROJECT,
        checkout: { installationId: INSTALLATION, githubRepoId: 42, baseBranch: 'main' },
        prompt: 'Fix the failing test',
        model: 'grok-4.7',
      });
      expect(command.idempotencyKey).toMatch(/^bot:turn-1:[0-9a-f]{32}$/);
      expect(result.content).toContain('https://cursor.com/agents?id=bc-session-1');
      expect(result.data).toEqual({ sessionId: 'session-1' });
    });

    it('refuses a field its cloud does not take before any card, so the owner is never asked to approve what cannot start', async () => {
      const { commandBus, approvals, call } = setup('auto');
      const result = await call('start_cloud_session', {
        task: 'x',
        project_id: PROJECT,
        agent: 'cursor',
        host_id: HOME,
      });
      expect(result.isError).toBe(true);
      expect(result.content).toContain('host_id is only for claude-code and codex');
      expect(approvals.request).not.toHaveBeenCalled();
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('refuses a repository the project does not hold before any card', async () => {
      const { approvals, call } = setup('auto');
      const result = await call('start_cloud_session', {
        task: 'x',
        project_id: PROJECT,
        agent: 'codex',
        repository: 'acme/other',
      });
      expect(result.isError).toBe(true);
      expect(result.content).toContain('The project has no repository acme/other');
      expect(approvals.request).not.toHaveBeenCalled();
    });

    it('refuses a host for Cursor, which runs with none, launching nothing', async () => {
      const { commandBus, call } = setup('full');
      const result = await call('start_cloud_session', {
        task: 'x',
        project_id: PROJECT,
        agent: 'cursor',
        host_id: HOME,
      });
      expect(result.isError).toBe(true);
      expect(result.content).toContain(
        'host_id is only for claude-code and codex; leave it out for cursor.',
      );
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('refuses a model for a cloud a host starts, starting nothing', async () => {
      const { commandBus, call } = setup('full');
      const result = await call('start_cloud_session', {
        task: 'x',
        project_id: PROJECT,
        model: 'grok-4.7',
      });
      expect(result.isError).toBe(true);
      expect(result.content).toContain('model is only for cursor; leave it out for claude-code.');
      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });

  it('stops a session through the sessions’ own command, in the owner’s scope', async () => {
    const { commandBus, call } = setup('full');
    await call('stop_session', { session_id: HOME });
    expect(commandBus.execute).toHaveBeenCalledWith(expect.any(StopSessionCommand));
    expect(commandBus.execute.mock.calls[0][0]).toMatchObject({ scope: owner, sessionId: HOME });
  });

  // What breaks this: an offline host's stop was answered "sent when it comes
  // back", but the API sends again only owed launches and closes, never a stop.
  it('does not promise a stop to an offline host, and tells the bot to check and stop again', async () => {
    const { commandBus, call, session } = setup('full');
    commandBus.execute.mockResolvedValueOnce({ sessionId: session.id, hints: ['host_offline'] });
    const result = await call('stop_session', { session_id: session.id });
    expect(result.content).toContain('the stop did not reach it and is not sent again');
    expect(result.content).not.toContain('when it comes back');
  });

  it('asks before prompting a session, the card naming the session and the words', async () => {
    const { commandBus, approvals, call, session } = setup('auto');
    await call('send_to_session', { session_id: session.id, text: 'Now run the tests' });
    expect(approvals.request.mock.calls[0][0]).toMatchObject({
      tool: 'send_to_session',
      summary: 'Tell the session "Fix login": Now run the tests',
    });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('sends a prompt as the bot whose turn made the call, and follows the task it starts', async () => {
    const { commandBus, watches, call, session } = setup('full');
    const result = await call('send_to_session', { session_id: session.id, text: 'Run the tests' });
    const command = commandBus.execute.mock.calls[0][0] as SendSessionPromptCommand;
    expect(command).toBeInstanceOf(SendSessionPromptCommand);
    expect(command).toMatchObject({
      scope: owner,
      sessionId: session.id,
      text: 'Run the tests',
      sender: { kind: 'bot', botId: 'bot-1', turnId: 'turn-1' },
    });
    // The session had no task yet, so the prompt opens task 1, and that is the one watched.
    expect(watches.follow).toHaveBeenCalledWith(
      expect.anything(),
      session.id,
      { turn: 1 },
      undefined,
    );
    expect(result.content).toContain('You follow its task.');
    // Where the log stood once the prompt was in, so the next read starts after it.
    expect(result.content).toContain('read_session with after_seq 7 reads only what followed');
  });

  it('names the option it picks on the card, read against what the session waits on', async () => {
    const { approvals, call, session } = setup('auto');
    await call('answer_session', { session_id: session.id, decision_id: 'perm-1', option: 1 });
    expect(approvals.request.mock.calls[0][0].summary).toBe(
      'Answer "Fix login"\'s dialog "Do you want to proceed?": No',
    );
  });

  it('refuses an answer to a decision the session no longer waits on, before any card', async () => {
    const { approvals, commandBus, call, session } = setup('auto');
    const result = await call('answer_session', {
      session_id: session.id,
      decision_id: 'perm-0',
      option: 0,
    });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('now waits on decision perm-1');
    expect(approvals.request).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('answers through the sessions’ own command, in the owner’s scope', async () => {
    const { commandBus, call, session } = setup('full');
    await call('answer_session', { session_id: session.id, decision_id: 'perm-1', option: 0 });
    const command = commandBus.execute.mock.calls[0][0] as AnswerSessionDecisionCommand;
    expect(command).toBeInstanceOf(AnswerSessionDecisionCommand);
    expect(command).toMatchObject({
      scope: owner,
      sessionId: session.id,
      answer: { id: 'perm-1', option: 0 },
    });
  });
  // What breaks this: an agent that finishes between the answer and the
  // watch, so a watch taken from "now" counts its end as known and the bot
  // is never told how the task it unblocked went.
  it('follows the task it unblocked by the number read before answering, unless told not to watch', async () => {
    const { watches, call, session } = setup('full');
    session.reseatLatestTurn({
      ...(session.latestTurn ?? {}),
      seq: 3,
      state: 'requires_action',
    } as SessionTurnFold);
    const result = await call('answer_session', {
      session_id: session.id,
      decision_id: 'perm-1',
      option: 0,
    });
    expect(watches.follow).toHaveBeenCalledWith(
      expect.anything(),
      session.id,
      { answered: 3 },
      undefined,
    );
    expect(result.content).toContain('You follow its task.');

    watches.follow.mockClear();
    await call('answer_session', {
      session_id: session.id,
      decision_id: 'perm-1',
      option: 0,
      watch: false,
    });
    expect(watches.follow).toHaveBeenCalledWith(
      expect.anything(),
      session.id,
      { answered: 3 },
      false,
    );
  });

  // Who decides is the bot's preset (Jordi, 2026-11-10): under Approve for
  // me the person, on a card of its own past every grant; under Full access
  // the bot. What breaks this: a grant given for answering tests letting a
  // recursive delete through unseen, or a card stopping a Full access bot.
  it('under Approve for me, puts letting a destructive dialog through on a card offering only this call', async () => {
    const { queryBus, commandBus, approvals, call } = setup('auto');
    const destructive = destructiveSession();
    queryBus.execute.mockResolvedValue(destructive);
    await call('answer_session', { session_id: destructive.id, decision_id: 'perm-2', option: 0 });
    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({ tool: 'answer_session', perCallOnly: true }),
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('under Full access, lets a destructive dialog through on its own', async () => {
    const { queryBus, commandBus, approvals, call } = setup('full');
    const destructive = destructiveSession();
    queryBus.execute.mockResolvedValue(destructive);
    await call('answer_session', { session_id: destructive.id, decision_id: 'perm-2', option: 0 });
    expect(approvals.request).not.toHaveBeenCalled();
    expect(commandBus.execute.mock.calls[0][0]).toMatchObject({
      answer: { id: 'perm-2', option: 0 },
    });
  });

  it('turns a destructive dialog down on its own under Full access', async () => {
    const { queryBus, commandBus, approvals, call } = setup('full');
    const destructive = destructiveSession();
    queryBus.execute.mockResolvedValue(destructive);
    await call('answer_session', { session_id: destructive.id, decision_id: 'perm-2', option: 2 });
    expect(approvals.request).not.toHaveBeenCalled();
    expect(commandBus.execute.mock.calls[0][0]).toMatchObject({
      answer: { id: 'perm-2', option: 2 },
    });
  });

  // What breaks this: under Approve for me, a lookup that fails here and
  // succeeds in the command lets a destructive approval through on a grant.
  it('under Approve for me, puts an answer whose decision it cannot read on a card of its own', async () => {
    const { queryBus, commandBus, approvals, call, session } = setup('auto');
    queryBus.execute.mockRejectedValueOnce(new Error('connection reset'));
    await call('answer_session', { session_id: session.id, decision_id: 'perm-1', option: 0 });
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({ tool: 'answer_session', perCallOnly: true }),
    );
  });

  describe('close_session', () => {
    it('asks first, the card naming the session and that its worktree goes, nothing closed', async () => {
      const { queryBus, commandBus, approvals, call } = setup('auto');
      const failed = failedBotSession();
      queryBus.execute.mockResolvedValue(failed);
      await call('close_session', { session_id: failed.id });
      expect(approvals.request.mock.calls[0][0]).toMatchObject({
        tool: 'close_session',
        summary: `Close the session "Bump deps" (${failed.id}) and remove its worktree`,
        subject: { kind: 'session', key: failed.id, label: 'Bump deps' },
      });
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('closes a failed session a bot started through the sessions’ own close, keeping unpushed work', async () => {
      const { queryBus, commandBus, call } = setup('full');
      const failed = failedBotSession();
      queryBus.execute.mockResolvedValue(failed);
      const result = await call('close_session', { session_id: failed.id });
      const command = commandBus.execute.mock.calls[0][0] as CloseSessionCommand;
      expect(command).toBeInstanceOf(CloseSessionCommand);
      expect(command).toMatchObject({
        scope: owner,
        sessionId: failed.id,
        acceptUnpushedWork: false,
      });
      expect(result.isError).toBeFalsy();
      expect(result.content).toContain(`Asked session ${failed.id} to close.`);
    });

    // What breaks this: a cloud session's close was answered "closes once its
    // host hears it", though it has no host and was already closed.
    it('says a cloud session is closed, not that it waits on a host', async () => {
      const { queryBus, call } = setup('full');
      const cloud = cloudSession(null, 'claude-code', 'bot');
      queryBus.execute.mockResolvedValue(cloud);
      const result = await call('close_session', { session_id: cloud.id });
      expect(result.content).toBe(`Session ${cloud.id} is closed.`);
    });

    it('refuses a session the person started, under either permission, closing nothing', async () => {
      for (const permission of ['auto', 'full'] as const) {
        const { commandBus, approvals, call, session } = setup(permission);
        const result = await call('close_session', { session_id: session.id });
        expect(result.isError).toBe(true);
        expect(result.content).toContain('was not started by a bot (it is a person session)');
        expect(approvals.request).not.toHaveBeenCalled();
        expect(commandBus.execute).not.toHaveBeenCalled();
      }
    });
  });
});
