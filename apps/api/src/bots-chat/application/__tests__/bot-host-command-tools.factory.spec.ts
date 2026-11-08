import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { describe, expect, it, vi } from 'vitest';
import { RunHostCommandCommand } from '../../../sessions/commands/run-host-command/run-host-command.command';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import { BotHostCommandToolsFactory } from '../bot-host-command-tools.factory';
import { BotHostTargetResolver } from '../bot-host-target.resolver';
import type { BotToolContext } from '../bot-tool.factory';

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';

function setup(permission: BotToolContext['permission']) {
  const request = vi.fn().mockResolvedValue({ status: 'requested', approvalId: 'a-1' });
  const context: BotToolContext = {
    owner: emptyScope('owner-1', 'org-1'),
    organizationId: 'org-1',
    botId: 'BOT-1',
    turnId: 'turn-1',
    homeHostId: HOST,
    timeZone: 'Europe/Madrid',
    permission,
    permissions: NO_PERMISSIONS,
    budget: new BotTurnBudget(),
    approvals: { request },
  };
  // Only HOST is the owner's: any other id is not found, as FindHostQuery answers it.
  const queryBus = {
    execute: vi.fn(async (query: { hostId?: string }) => {
      if (query.hostId !== HOST) throw new Error('not found');
      return { host: { name: 'build-02' } };
    }),
  };
  const commandBus = {
    execute: vi.fn().mockResolvedValue({
      kind: 'ran',
      run: {
        exitCode: 0,
        timedOut: false,
        stdout: 'ok',
        stderr: '',
        cwd: '/w/bots/bot-1',
        durationMs: 3,
      },
    }),
  };
  const factory = new BotHostCommandToolsFactory(
    commandBus as unknown as CommandBus,
    new BotHostTargetResolver(queryBus as unknown as QueryBus),
  );
  const tool = factory.definitions()[0];
  if (!tool) throw new Error('no run_command');
  const call = (input: unknown) =>
    tool.bind(context).run(input, { signal: new AbortController().signal });
  return { call, request, commandBus };
}

describe('run_command', () => {
  // A grant's key is cut to fit its column; a program in it as text would let
  // a yes for one long path cover every program that starts the same way.
  it('keys a standing yes to the program itself, however long its path', async () => {
    const { call, request } = setup('auto');
    const prefix = `/home/jordi/${'a'.repeat(300)}`;
    await call({ argv: [`${prefix}/one.sh`] });
    await call({ argv: [`${prefix}/two.sh`] });
    const [first, second] = request.mock.calls.map(([asked]) => asked.subject);
    expect(first.key).not.toBe(second.key);
    expect(first.key.length).toBeLessThanOrEqual(200);
    expect(first.kind).toBe('host_program');
  });

  it('asks first under Approve for me, with the command line on the card', async () => {
    const { call, request, commandBus } = setup('auto');
    await call({ argv: ['python3', 'report.py'] });
    expect(request.mock.calls[0]?.[0].summary).toBe('Run `python3 report.py` on build-02');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('runs on the home host, in the bot’s own folder, under Full access', async () => {
    const { call, commandBus } = setup('full');
    await call({ argv: ['ls'] });
    const command = commandBus.execute.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(RunHostCommandCommand);
    expect(command).toMatchObject({
      hostId: HOST,
      request: { argv: ['ls'], home: 'bot-1', timeoutSeconds: 60 },
    });
  });

  // A real model filled host_id with an all-zero UUID; the card it raised was
  // approved only to fail on "Host not found". No card for a host that is not
  // the owner's: the model is told, and can correct it in the same turn.
  it('raises no card for a host that is not the owner’s, and says how to pick one', async () => {
    const { call, request, commandBus } = setup('auto');
    const result = await call({
      argv: ['python3', '--version'],
      host_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(request).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).toContain('is not one of the person');
  });
});
