/**
 * Every new bot gets its heartbeat (`26-bot-routines.md` §6). What breaks
 * this: a bot born with no routine that wakes it, a redelivered creation
 * saving a second heartbeat, a heartbeat saved wider than the token that made
 * the bot, and one saved for an owner who is gone. The routine save itself is
 * `save-bot-routine.command-handler.spec.ts`; the minute and the prompt are
 * `bot-heartbeat.policy.spec.ts`.
 */
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { type AccessScope, emptyScope } from '@oppenheimer/backend-authz';
import { SaveBotRoutineCommand } from '../../../automations/commands/save-bot-routine/save-bot-routine.command';
import type { AutomationEntity } from '../../../automations/domain/automation.entity';
import type { AutomationListing } from '../../../automations/domain/automation-read.types';
import { HEARTBEAT_NAME, heartbeatTrigger } from '../../domain/bot-heartbeat.policy';
import type { BotOwnerScopeResolver } from '../bot-owner-scope.resolver';
import { BotHeartbeatDomainEventHandler } from '../event-handlers/bot-heartbeat.domain-event-handler';

function setup(options: { owner?: AccessScope | null; routines?: string[] } = {}) {
  const owner = options.owner === undefined ? emptyScope('owner-1', 'org-1') : options.owner;
  const owners = { resolve: vi.fn<BotOwnerScopeResolver['resolve']>(async () => owner) };
  const listing: AutomationListing = {
    automations: (options.routines ?? []).map((name) => ({ name }) as AutomationEntity),
    digests: new Map(),
  };
  const queries = { execute: vi.fn(async () => listing) };
  const commands = { execute: vi.fn(async () => 'routine-1') };
  const handler = new BotHeartbeatDomainEventHandler(
    owners as unknown as BotOwnerScopeResolver,
    commands as unknown as CommandBus,
    queries as unknown as QueryBus,
  );
  const created = {
    aggregateId: 'bot-1',
    organizationId: 'org-1',
    createdByUserId: 'owner-1',
    credentialScopes: ['bots:write' as const],
  };
  return { owners, queries, commands, handler, created };
}

describe('BotHeartbeatDomainEventHandler', () => {
  it("saves an hourly heartbeat, on, as the bot's owner and within the creating credential's scopes", async () => {
    const { owners, commands, handler, created } = setup();
    await handler.handle(created);

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

  it('saves nothing when the owner is gone or left the workspace', async () => {
    const { queries, commands, handler, created } = setup({ owner: null });
    await handler.handle(created);
    expect(queries.execute).not.toHaveBeenCalled();
    expect(commands.execute).not.toHaveBeenCalled();
  });
});
