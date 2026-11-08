import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { describe, expect, it, vi } from 'vitest';
import { DriveSessionTerminalCommand } from '../../../sessions/commands/drive-session-terminal/drive-session-terminal.command';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import { BotHostTargetResolver } from '../bot-host-target.resolver';
import { BotTerminalToolsFactory } from '../bot-terminal-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';
const SESSION = '3f0d9e2c-6a4b-4e9a-9c3d-7b1e5a2f8c40';

function setup() {
  const request = vi.fn().mockResolvedValue({ status: 'requested', approvalId: 'a-1' });
  const context: BotToolContext = {
    owner: emptyScope('owner-1', 'org-1'),
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    homeHostId: HOST,
    timeZone: 'Europe/Madrid',
    permission: 'auto',
    permissions: NO_PERMISSIONS,
    budget: new BotTurnBudget(),
    approvals: { request },
  };
  const queryBus = {
    execute: vi.fn(async (query: { hostId?: string }) => {
      if (query.hostId !== HOST) throw new Error('not found');
      return { host: { name: 'build-02' } };
    }),
  };
  const commandBus = {
    execute: vi.fn().mockResolvedValue({
      kind: 'screen',
      screen: { screen: 'jordi@build-02:~$ ', matched: true, waitedMs: 300 },
    }),
  };
  const factory = new BotTerminalToolsFactory(
    commandBus as unknown as CommandBus,
    new BotHostTargetResolver(queryBus as unknown as QueryBus),
  );
  const call = (name: string, input: unknown) => {
    const tool = factory.definitions().find((definition) => definition.name === name);
    if (!tool) throw new Error(`no ${name}`);
    return tool.bind(context).run(input, { signal: new AbortController().signal });
  };
  return { call, request, commandBus };
}

describe('terminal tools', () => {
  it('asks before typing, with what it will type on the card', async () => {
    const { call, request, commandBus } = setup();
    await call('type_in_terminal', { session_id: SESSION, text: 'ssh build-02', keys: ['Enter'] });
    const asked = request.mock.calls[0]?.[0];
    expect(asked.summary).toBe(`Type \`ssh build-02\` then Enter in terminal ${SESSION}`);
    expect(asked.subject).toMatchObject({ kind: 'session', key: SESSION });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  // Reading types nothing, so it runs at once, waiting the default.
  it('reads without asking', async () => {
    const { call, request, commandBus } = setup();
    const result = await call('read_terminal', { session_id: SESSION, wait_for: '\\$ $' });
    expect(request).not.toHaveBeenCalled();
    const command = commandBus.execute.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(DriveSessionTerminalCommand);
    expect(command.request).toEqual({ waitFor: '\\$ $', waitSeconds: 2 });
    expect(JSON.stringify(result)).toContain('jordi@build-02');
  });

  // The same host check as run_command: no card for a made-up host.
  it('opens no terminal on a host that is not the owner’s', async () => {
    const { call, request } = setup();
    const result = await call('open_terminal', {
      folder: '/home/jordi',
      host_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(request).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).toContain('is not one of the person');
  });
});
