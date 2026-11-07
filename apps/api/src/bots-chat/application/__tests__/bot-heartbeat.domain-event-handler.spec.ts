/**
 * A bot that gets a job gets its heartbeat (`26-bot-routines.md` §6). What
 * breaks this: a bot with a job and no routine that wakes it, a redelivered
 * event saving a second heartbeat, a heartbeat saved wider than the token that
 * wrote the job, one saved for someone other than the bot's owner, and one
 * saved for a bot or owner that is gone. When the event is raised is
 * `bot-document.entity.spec.ts`; the routine save itself is
 * `save-bot-routine.command-handler.spec.ts`; the minute and the prompt are
 * `bot-heartbeat.policy.spec.ts`.
 */
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { type AccessScope, emptyScope } from '@oppenheimer/backend-authz';
import { SaveBotRoutineCommand } from '../../../automations/commands/save-bot-routine/save-bot-routine.command';
import type { AutomationEntity } from '../../../automations/domain/automation.entity';
import type { AutomationListing } from '../../../automations/domain/automation-read.types';
import type { BotEntity } from '../../../bots/domain/bot.entity';
import { HEARTBEAT_NAME, heartbeatTrigger } from '../../domain/bot-heartbeat.policy';
import type { BotModelAccessResolver } from '../bot-model-access.resolver';
import type { BotOwnerScopeResolver } from '../bot-owner-scope.resolver';
import { BotHeartbeatDomainEventHandler } from '../event-handlers/bot-heartbeat.domain-event-handler';

function setup(
  options: { owner?: AccessScope | null; routines?: string[]; botGone?: boolean } = {},
) {
  const owner = options.owner === undefined ? emptyScope('owner-1', 'org-1') : options.owner;
  const bot = { id: 'bot-1', createdByUserId: 'owner-1' } as BotEntity;
  const bots = {
    findBot: vi.fn<BotModelAccessResolver['findBot']>(async () => (options.botGone ? null : bot)),
  };
  const owners = { resolve: vi.fn<BotOwnerScopeResolver['resolve']>(async () => owner) };
  const listing: AutomationListing = {
    automations: (options.routines ?? []).map((name) => ({ name }) as AutomationEntity),
    digests: new Map(),
  };
  const queries = { execute: vi.fn(async () => listing) };
  const commands = { execute: vi.fn(async () => 'routine-1') };
  const handler = new BotHeartbeatDomainEventHandler(
    bots as unknown as BotModelAccessResolver,
    owners as unknown as BotOwnerScopeResolver,
    commands as unknown as CommandBus,
    queries as unknown as QueryBus,
  );
  const created = {
    organizationId: 'org-1',
    botId: 'bot-1',
    credentialScopes: ['bots:write' as const],
  };
  return { bots, owners, queries, commands, handler, created };
}

describe('BotHeartbeatDomainEventHandler', () => {
  it("saves an hourly heartbeat, on, as the bot's owner and within the writing credential's scopes", async () => {
    const { bots, owners, commands, handler, created } = setup();
    await handler.handle(created);

    expect(bots.findBot).toHaveBeenCalledWith('org-1', 'bot-1');
    expect(owners.resolve).toHaveBeenCalledWith('org-1', 'owner-1');
    expect(commands.execute).toHaveBeenCalledTimes(1);
    const [command] = commands.execute.mock.calls[0] as unknown as [SaveBotRoutineCommand];
    expect(command).toBeInstanceOf(SaveBotRoutineCommand);
    expect(command).toMatchObject({
      botId: 'bot-1',
      routineId: null,
      credentialScopes: ['bots:write'],
      changes: { name: HEARTBEAT_NAME, enabled: true, triggers: [heartbeatTrigger('bot-1')] },
    });
    expect(command.scope).toMatchObject({ userId: 'owner-1', organizationId: 'org-1' });
  });

  // The regression: the outbox delivers at least once, and each delivery added a heartbeat.
  it('saves nothing for a bot that already has its heartbeat', async () => {
    const { commands, handler, created } = setup({ routines: ['PR review', HEARTBEAT_NAME] });
    await handler.handle(created);
    expect(commands.execute).not.toHaveBeenCalled();
  });

  it('saves nothing for a bot deleted before the event was delivered', async () => {
    const { owners, commands, handler, created } = setup({ botGone: true });
    await handler.handle(created);
    expect(owners.resolve).not.toHaveBeenCalled();
    expect(commands.execute).not.toHaveBeenCalled();
  });

  it('saves nothing when the owner is gone or left the workspace', async () => {
    const { queries, commands, handler, created } = setup({ owner: null });
    await handler.handle(created);
    expect(queries.execute).not.toHaveBeenCalled();
    expect(commands.execute).not.toHaveBeenCalled();
  });
});
