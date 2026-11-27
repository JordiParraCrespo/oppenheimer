/**
 * `set_host_settings`: a bot turns a host's switches on when the person asks,
 * instead of telling them to type `runner browser on`. Proves what the card
 * says, that only the fields given reach the runner, and that an empty call
 * raises no card. The runner's side (the files written) is
 * `apps/runner/internal/cli/link_settings_test.go`.
 */
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { describe, expect, it, vi } from 'vitest';
import { SetHostSettingsCommand } from '../../../sessions/commands/set-host-settings/set-host-settings.command';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import { BotHostSettingsToolsFactory } from '../bot-host-settings-tools.factory';
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
  const queryBus = {
    execute: vi.fn(async (query: { hostId?: string }) => {
      if (query.hostId !== HOST) throw new Error('not found');
      return { host: { name: 'pop-os' } };
    }),
  };
  const commandBus = {
    execute: vi.fn().mockResolvedValue({
      kind: 'set',
      settings: { browser: 'on', computer: 'off', execMode: 'off', execAllow: [] },
    }),
  };
  const factory = new BotHostSettingsToolsFactory(
    commandBus as unknown as CommandBus,
    new BotHostTargetResolver(queryBus as unknown as QueryBus),
  );
  const tool = factory.definitions()[0];
  if (!tool) throw new Error('no set_host_settings');
  const call = (input: unknown) =>
    tool.bind(context).run(input, { signal: new AbortController().signal });
  return { call, request, commandBus };
}

describe('set_host_settings', () => {
  it('turns the browser on for the person under Full access and says what the host allows now', async () => {
    const { call, commandBus } = setup('full');
    const result = await call({ browser: 'on' });
    const command = commandBus.execute.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(SetHostSettingsCommand);
    // Only what the call gives: a browser change never resets the exec policy.
    expect(command).toMatchObject({ hostId: HOST, change: { browser: 'on' } });
    expect(Object.keys(command.change)).toEqual(['browser']);
    expect(JSON.stringify(result)).toContain('pop-os now allows: browser on');
  });

  it('asks first under Auto, with what changes on the card, and changes nothing yet', async () => {
    const { call, request, commandBus } = setup('auto');
    await call({ browser: 'on', exec_mode: 'allowlist', exec_allow: ['python3'] });
    expect(request.mock.calls[0]?.[0].summary).toBe(
      'On pop-os: turn the browser for bots on, set commands to allowlist, allow python3',
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('raises no card for a call that changes nothing', async () => {
    const { call, request, commandBus } = setup('auto');
    const result = await call({});
    expect(request).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).toContain('Give at least one of');
  });
});
