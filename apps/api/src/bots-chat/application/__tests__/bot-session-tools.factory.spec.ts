import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { FIELD_BOUNDS } from '@oppenheimer/shared';
import { FindHostQuery } from '../../../hosts/queries/find-host/find-host.query';
import { CreateSessionCommand } from '../../../sessions/commands/create-session/create-session.command';
import { StopSessionCommand } from '../../../sessions/commands/stop-session/stop-session.command';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import { BotSessionToolsFactory } from '../bot-session-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

/**
 * Starting and stopping sessions reach the owner's machines, so they ask:
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
  approvals,
  budget: new BotTurnBudget(),
});

const project = {
  id: PROJECT,
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

function setup(permission: BotToolContext['permission']) {
  const queryBus = {
    execute: vi.fn(async (query: unknown) => {
      if (query instanceof FindHostQuery) return { host: { name: 'build-02' }, online: true };
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
    execute: vi.fn(async () => ({ sessionId: 'session-1', hints: [] as string[] })),
  };
  const factory = new BotSessionToolsFactory(
    queryBus as unknown as QueryBus,
    commandBus as unknown as CommandBus,
  );
  const call = (name: string, input: unknown) => {
    const definition = factory.definitions().find((candidate) => candidate.name === name);
    if (!definition) throw new Error(`no tool ${name}`);
    return definition
      .bind(context(permission, approvals))
      .run(input, { signal: new AbortController().signal });
  };
  return { queryBus, commandBus, approvals, call };
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
      summary: 'Start Claude Code on build-02 in acme/xrp-mobile: Fix the test',
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
      `Start Claude Code on build-02 in project ${PROJECT}: Upgrade`,
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

  it('stops a session through the sessions’ own command, in the owner’s scope', async () => {
    const { commandBus, call } = setup('full');
    await call('stop_session', { session_id: HOME });
    expect(commandBus.execute).toHaveBeenCalledWith(expect.any(StopSessionCommand));
    expect(commandBus.execute.mock.calls[0][0]).toMatchObject({ scope: owner, sessionId: HOME });
  });
});
