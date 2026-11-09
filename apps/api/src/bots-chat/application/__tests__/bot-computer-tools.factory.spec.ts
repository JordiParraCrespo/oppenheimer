import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { describe, expect, it, vi } from 'vitest';
import { UseHostComputerCommand } from '../../../sessions/commands/use-host-computer/use-host-computer.command';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import { computerCommandIdOf } from '../bot-computer.policy';
import { BotComputerToolsFactory } from '../bot-computer-tools.factory';
import { BotHostTargetResolver } from '../bot-host-target.resolver';
import type { BotToolContext } from '../bot-tool.factory';

const HOST = 'd0c6e4f2-3041-4c5d-8e6f-70819203b4c5';

function setup(overrides: Partial<BotToolContext> = {}, outcome?: unknown) {
  const request = vi.fn().mockResolvedValue({ status: 'requested', approvalId: 'a-1' });
  const context: BotToolContext = {
    owner: emptyScope('owner-1', 'org-1'),
    organizationId: 'org-1',
    botId: 'bot-1',
    conversationId: 'bot-1',
    turnId: 'turn-1',
    homeHostId: HOST,
    timeZone: 'Europe/Madrid',
    permission: 'full',
    permissions: NO_PERMISSIONS,
    budget: new BotTurnBudget(),
    credentialScopes: null,
    seesImages: true,
    approvals: { request },
    ...overrides,
  };
  const queryBus = {
    execute: vi.fn(async (query: { hostId?: string }) => {
      if (query.hostId !== HOST) throw new Error('not found');
      return { host: { name: 'studio' } };
    }),
  };
  const commandBus = {
    execute: vi.fn().mockResolvedValue(
      outcome ?? {
        kind: 'screen',
        screen: { image: 'c2NyZWVu', width: 1280, height: 800 },
      },
    ),
  };
  const tool = new BotComputerToolsFactory(
    commandBus as unknown as CommandBus,
    new BotHostTargetResolver(queryBus as unknown as QueryBus),
  ).definitions()[0];
  if (!tool) throw new Error('no use_computer');
  const call = (input: unknown) =>
    tool.bind(context).run(input, { signal: new AbortController().signal });
  return { tool, call, request, commandBus, context };
}

describe('use_computer', () => {
  // The screenshot is the whole point of a step: it must reach the model as
  // an image, and the words must say what size to point in.
  it('answers a step with the screen as an image the model reads', async () => {
    const { call, commandBus } = setup();
    const result = await call({ action: 'click', x: 640, y: 412 });
    const command = commandBus.execute.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(UseHostComputerCommand);
    expect(command.hostId).toBe(HOST);
    expect(command.request).toEqual({ action: 'click', x: 640, y: 412 });
    expect(result.images).toEqual([{ mimeType: 'image/jpeg', data: 'c2NyZWVu' }]);
    expect(result.content).toContain('1280 by 800');
    expect(result.content).not.toContain('c2NyZWVu');
  });

  // One card per host, not per click: "always" on it must cover the next step.
  it('asks under Approve for me, once for the host’s screen', async () => {
    const { call, request, commandBus } = setup({ permission: 'auto' });
    await call({ action: 'type', text: 'hello' });
    const asked = request.mock.calls[0]?.[0];
    expect(asked.summary).toBe('Type `hello` on the screen of studio');
    expect(asked.subject).toMatchObject({ kind: 'host_screen', key: HOST });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  // A model that cannot read the screenshot would click blind: it is told
  // so before any card is raised or anything moves.
  it('refuses a model that reads no images, before a card or an action', async () => {
    const { call, request, commandBus } = setup({ permission: 'auto', seesImages: false });
    const result = await call({ action: 'screenshot' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('cannot read images');
    expect(request).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('refuses an action missing what it needs, without touching the host', async () => {
    const { call, commandBus } = setup();
    const result = await call({ action: 'drag', x: 1, y: 1 });
    expect(result.content).toBe('drag needs x, y, to_x and to_y.');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  // An approved call runs after its turn, where no model reads an image, and
  // may be retried: it carries the approval's own command id and no picture.
  it('carries out an approved call once, by the approval’s id, with no image', async () => {
    const { tool, commandBus, context } = setup({ seesImages: undefined });
    const { approvals: _approvals, permissions: _permissions, ...approved } = context;
    const result = await tool.runApproved(
      { action: 'click', x: 5, y: 6, host_id: HOST },
      { ...approved, approvalId: 'approval-9' },
      new AbortController().signal,
    );
    expect(commandBus.execute.mock.calls[0]?.[0].commandId).toBe(computerCommandIdOf('approval-9'));
    expect(result.modelImages).toBeUndefined();
    expect(result.content).toContain('action screenshot');
  });

  // The host's own switch is the person's to flip: the bot is told how, and
  // that nothing happened.
  it('passes on the host’s refusal with who can change it', async () => {
    const { call } = setup(
      {},
      { kind: 'failed', code: 'COMPUTER_001', detail: 'runner computer on' },
    );
    const result = await call({ action: 'screenshot' });
    expect(result.content).toContain('COMPUTER_001');
    expect(result.content).toContain('Nothing was done.');
    expect(result.content).toContain('`runner computer on`');
    expect(result.images).toBeUndefined();
  });
});
