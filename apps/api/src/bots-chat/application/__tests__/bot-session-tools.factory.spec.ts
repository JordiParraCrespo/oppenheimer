import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { CreateSessionCommand } from '../../../sessions/commands/create-session/create-session.command';
import { StopSessionCommand } from '../../../sessions/commands/stop-session/stop-session.command';
import { BotSessionToolsFactory } from '../bot-session-tools.factory';
import { type BotToolContext, NEEDS_APPROVAL } from '../bot-tool.factory';

/**
 * Starting and stopping sessions reach the owner's machines, so they ask:
 * under Approve for me nothing is dispatched and the model is told why;
 * under Full access the sessions' own commands run in the owner's scope,
 * the session marked as the bot's, and the same call in the same turn
 * starts one session. The commands themselves are the sessions module's.
 */
const owner = emptyScope('owner-1', 'org-1');
const HOME = '11111111-1111-4111-8111-111111111111';
const PROJECT = '22222222-2222-4222-8222-222222222222';
const INSTALLATION = '44444444-4444-4444-8444-444444444444';

const context = (permission: BotToolContext['permission']): BotToolContext => ({
  owner,
  organizationId: 'org-1',
  botId: 'bot-1',
  turnId: 'turn-1',
  homeHostId: HOME,
  timeZone: 'UTC',
  permission,
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
  const queryBus = { execute: vi.fn(async () => project) };
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
      .bind(context(permission))
      .run(input, { signal: new AbortController().signal });
  };
  return { queryBus, commandBus, call };
}

describe('BotSessionToolsFactory', () => {
  it('asks first under Approve for me: nothing is started, and the model is told', async () => {
    const { commandBus, queryBus, call } = setup('auto');
    expect(await call('start_session', { task: 'Fix the test', project_id: PROJECT })).toEqual({
      content: NEEDS_APPROVAL,
    });
    expect(await call('stop_session', { session_id: HOME })).toEqual({ content: NEEDS_APPROVAL });
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(queryBus.execute).not.toHaveBeenCalled();
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

  it('refuses a repository the project does not hold, naming the ones it does, starting nothing', async () => {
    const { commandBus, call } = setup('full');
    const result = await call('start_session', {
      task: 'x',
      project_id: PROJECT,
      repository: 'acme/other',
    });
    expect(result.content).toContain('The project has no repository acme/other');
    expect(result.content).toContain('acme/xrp-mobile');
    expect(commandBus.execute).not.toHaveBeenCalled();
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
