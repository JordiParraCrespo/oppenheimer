import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { BOT_AVATAR_COLORS } from '@oppenheimer/shared';
import { CreateBotCommand } from '../../../bots/commands/create-bot/create-bot.command';
import { DeleteBotCommand } from '../../../bots/commands/delete-bot/delete-bot.command';
import { BotEntity } from '../../../bots/domain/bot.entity';
import { BotGroupEntity } from '../../../bots/domain/bot-group.entity';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { FindBotQuery } from '../../../bots/queries/find-bot/find-bot.query';
import { FindBotGroupsQuery } from '../../../bots/queries/find-bot-groups/find-bot-groups.query';
import { FindBotsQuery } from '../../../bots/queries/find-bots/find-bots.query';
import { FindModelProviderCredentialsQuery } from '../../../bots/queries/find-model-provider-credentials/find-model-provider-credentials.query';
import type { BotTurnRepositoryPort } from '../../database/bot-turn.repository.port';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotActorAbilityResolver } from '../bot-actor-ability.resolver';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import { BotPeerToolsFactory } from '../bot-bots-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

/**
 * The tools a bot reaches the workspace's other bots through: the reads
 * (the bots module's own queries in the owner's scope, answering what each
 * bot is for and what runs it, the asking bot marked as itself), and
 * `create_bot`, which asks under Approve for me and otherwise dispatches the
 * console's own create command as the owner, marked as the creator's, on the
 * creator's engine unless told otherwise, never looser than the creator, and
 * once per call; and `delete_bot`, which always asks, refuses itself, a bot
 * named wrong, a busy one and an owner without `delete Bot` before any card,
 * and checks all of it again when the approved call runs. The writes
 * themselves are the commands' and the integration spec's.
 */
const owner = emptyScope('owner-1', 'org-1');
const SELF_ID = '11111111-1111-4111-8111-111111111111';
const PEER_ID = '22222222-2222-4222-8222-222222222222';
const noTurns = {
  findForConversation: vi.fn(async () => []),
} as unknown as BotTurnRepositoryPort;
const mayDelete = { may: vi.fn(async () => true) } as unknown as BotActorAbilityResolver;
const context: BotToolContext = {
  owner,
  organizationId: 'org-1',
  botId: SELF_ID,
  turnId: 'turn-1',
  homeHostId: null,
  timeZone: 'Europe/Madrid',
  permission: 'auto',
  budget: new BotTurnBudget(),
  approvals: { request: vi.fn() },
};

function bot(id: string, name: string, description: string): BotEntity {
  return BotEntity.create({
    id,
    props: {
      organizationId: 'org-1',
      createdByUserId: 'owner-1',
      name,
      description,
      avatarColor: BOT_AVATAR_COLORS[0],
      groupId: null,
      position: 0,
      homeHostId: null,
      provider: 'glm',
      model: null,
      effort: null,
      permission: 'auto',
      learnAutomatically: true,
    },
  });
}

function setup(answer: (query: unknown) => unknown) {
  const queryBus = { execute: vi.fn(async (query: unknown) => answer(query)) };
  const commandBus = { execute: vi.fn() };
  const factory = new BotPeerToolsFactory(
    queryBus as unknown as QueryBus,
    commandBus as unknown as CommandBus,
    noTurns,
    mayDelete,
  );
  const call = (name: string, input: unknown) => {
    const found = factory.definitions().find((definition) => definition.name === name);
    if (!found) throw new Error(`no tool ${name}`);
    return found.bind(context).run(input, { signal: new AbortController().signal });
  };
  return { queryBus, call };
}

describe('BotPeerToolsFactory', () => {
  it('lists the workspace’s bots in the owner’s scope, with what each is for and itself marked', async () => {
    const { queryBus, call } = setup(() => [
      bot(SELF_ID, 'Ada', 'Release notes'),
      bot(PEER_ID, 'Grace', 'Reviews pull requests'),
    ]);
    const result = await call('list_bots', {});
    const query = queryBus.execute.mock.calls[0][0] as FindBotsQuery;
    expect(query).toBeInstanceOf(FindBotsQuery);
    expect(query.scope).toBe(owner);
    expect(result.content).toContain(`${SELF_ID} "Ada" (you) [Release notes; GLM GLM-5.3`);
    expect(result.content).toContain(`${PEER_ID} "Grace" [Reviews pull requests;`);
  });

  it('reads one bot by id', async () => {
    const { queryBus, call } = setup(() => bot(PEER_ID, 'Grace', 'Reviews pull requests'));
    const result = await call('get_bot', { bot_id: PEER_ID });
    const query = queryBus.execute.mock.calls[0][0] as FindBotQuery;
    expect(query).toBeInstanceOf(FindBotQuery);
    expect(query).toMatchObject({ scope: owner, botId: PEER_ID });
    expect(result.content).toContain('- for: Reviews pull requests');
    expect(result.content).toContain('- last message: never');
  });

  it('answers a malformed id as an error, dispatching nothing', async () => {
    const { queryBus, call } = setup(() => undefined);
    const result = await call('get_bot', { bot_id: 'grace' });
    expect(result.isError).toBe(true);
    expect(queryBus.execute).not.toHaveBeenCalled();
  });
});

const NEW_ID = '33333333-3333-4333-8333-333333333333';

function creator(permission: BotEntity['permission'] = 'auto'): BotEntity {
  return BotEntity.create({
    id: SELF_ID,
    props: {
      organizationId: 'org-1',
      createdByUserId: 'owner-1',
      name: 'Ada',
      description: 'Release notes',
      avatarColor: BOT_AVATAR_COLORS[0],
      groupId: null,
      position: 0,
      homeHostId: null,
      provider: 'glm',
      model: 'glm-5.3',
      effort: 'high',
      permission,
      learnAutomatically: true,
    },
  });
}

function created(command: CreateBotCommand): BotEntity {
  return BotEntity.create({
    id: NEW_ID,
    props: {
      organizationId: 'org-1',
      createdByUserId: 'owner-1',
      createdByBotId: command.creatorBotId ?? null,
      name: command.input.name ?? 'New Bot',
      description: command.input.description ?? '',
      avatarColor: BOT_AVATAR_COLORS[1],
      groupId: command.input.groupId ?? null,
      position: 0,
      homeHostId: null,
      provider: command.input.provider ?? 'anthropic',
      model: command.model ?? null,
      effort: command.effort ?? null,
      permission: command.permission ?? 'auto',
      learnAutomatically: true,
    },
  });
}

describe('create_bot', () => {
  const research = BotGroupEntity.createNew({ organizationId: 'org-1', name: 'Research' });

  function creating(
    permission: BotToolContext['permission'],
    options: { keyed?: string[]; creatorPermission?: BotEntity['permission'] } = {},
  ) {
    let last: CreateBotCommand | undefined;
    const queryBus = {
      execute: vi.fn(async (query: unknown) => {
        if (query instanceof FindModelProviderCredentialsQuery) {
          return (options.keyed ?? ['glm', 'anthropic']).map((provider) => ({ provider }));
        }
        if (query instanceof FindBotGroupsQuery) return [research];
        if (query instanceof FindBotQuery) {
          return query.botId === SELF_ID
            ? creator(options.creatorPermission ?? permission)
            : created(last as CreateBotCommand);
        }
        throw new Error('unexpected query');
      }),
    };
    const commandBus = {
      execute: vi.fn(async (command: unknown) => {
        last = command as CreateBotCommand;
        return NEW_ID;
      }),
    };
    const approvals = {
      request: vi.fn<BotApprovalRequesterPort['request']>(async () => ({
        status: 'requested',
        approvalId: 'approval-1',
      })),
    };
    const factory = new BotPeerToolsFactory(
      queryBus as unknown as QueryBus,
      commandBus as unknown as CommandBus,
      noTurns,
      mayDelete,
    );
    const definition = factory.definitions().find((candidate) => candidate.name === 'create_bot');
    if (!definition) throw new Error('no create_bot');
    const call = (input: unknown) =>
      definition
        .bind({ ...context, permission, approvals })
        .run(input, { signal: new AbortController().signal });
    const approved = (input: Record<string, unknown>, approvalId: string) =>
      definition.runApproved(
        input,
        { ...context, permission, approvalId },
        new AbortController().signal,
      );
    const command = (index = 0) => commandBus.execute.mock.calls[index][0] as CreateBotCommand;
    return { definition, queryBus, commandBus, approvals, call, approved, command };
  }

  it('is a bots:write tool that asks', () => {
    const { definition } = creating('auto');
    expect(definition.scope).toBe('bots:write');
  });

  it('asks first under Approve for me: a card naming the bot, its engine, its group and what it is for, nothing created', async () => {
    const { commandBus, approvals, call } = creating('auto');
    const result = await call({
      name: 'Scout',
      description: 'Finds papers on retrieval and summarises them every Monday',
      group: 'research',
    });
    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'create_bot',
        input: {
          name: 'Scout',
          description: 'Finds papers on retrieval and summarises them every Monday',
          provider: 'glm',
          model: 'glm-5.3',
          effort: 'high',
          permission: 'auto',
          group: research.id,
        },
        summary:
          'Create bot "Scout" on GLM GLM-5.3, in group Research: Finds papers on retrieval and summarises them every Monday',
      }),
    );
    expect(result.content).toContain('End your turn now');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('cuts a long description on the card and leaves out what is not there', async () => {
    const { approvals, call } = creating('auto');
    await call({ name: 'Scout', description: 'x'.repeat(250), provider: 'anthropic' });
    const { summary } = approvals.request.mock.calls[0][0];
    expect(summary).toMatch(/^Create bot "Scout" on Anthropic \S.*: x{159}…$/);
    await call({ name: 'Quiet' });
    expect(approvals.request.mock.calls[1][0].summary).toBe('Create bot "Quiet" on GLM GLM-5.3');
  });

  it('creates it at once under Full access, as the owner, marked as the creator’s, on the creator’s provider, model and effort', async () => {
    const { commandBus, command, call } = creating('full');
    const result = await call({
      name: 'Scout',
      description: 'Finds papers',
      soul: '# Soul\n\nYou are Scout.',
      instructions: 'Every Monday, list new papers.',
    });
    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(command()).toBeInstanceOf(CreateBotCommand);
    expect(command().scope).toBe(owner);
    expect(command().input).toEqual({
      name: 'Scout',
      description: 'Finds papers',
      groupId: null,
      provider: 'glm',
    });
    expect(command()).toMatchObject({
      creatorBotId: SELF_ID,
      model: 'glm-5.3',
      effort: 'high',
      permission: 'auto',
      soul: '# Soul\n\nYou are Scout.',
      instructions: 'Every Monday, list new papers.',
    });
    expect(result.isError).toBe(false);
    expect(result.content).toContain(`Created bot ${NEW_ID} "Scout"`);
    expect(result.content).toContain('- runs on: GLM GLM-5.3 (provider glm, model glm-5.3)');
    expect(result.content).toContain('- permission: Approve for me (auto)');
    expect(result.content).toContain('open it from the sidebar');
  });

  it('runs a provider other than the creator’s on that provider’s default model, with no effort', async () => {
    const { command, call } = creating('full');
    await call({ name: 'Scout', provider: 'anthropic' });
    expect(command().input.provider).toBe('anthropic');
    expect(command()).toMatchObject({ model: null, effort: null });
  });

  it('takes a model by its label as well as its id', async () => {
    const { command, call } = creating('full');
    await call({ name: 'Scout', model: 'glm-5.3', effort: 'low' });
    expect(command()).toMatchObject({ model: 'glm-5.3', effort: 'low' });
    await call({ name: 'Scout', model: 'GLM-5.3' });
    expect(command(1).model).toBe('glm-5.3');
  });

  it('refuses a provider the workspace has no key for, naming the ones it can use, and creates nothing', async () => {
    const { commandBus, call } = creating('full', { keyed: ['glm'] });
    const result = await call({ name: 'Scout', provider: 'openai' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('The workspace has no OpenAI key');
    expect(result.content).toContain('Providers it can use: glm (GLM)');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('refuses a keyless provider before raising a card under Approve for me', async () => {
    const { approvals, call } = creating('auto', { keyed: [] });
    const result = await call({ name: 'Scout' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('no model provider key');
    expect(approvals.request).not.toHaveBeenCalled();
  });

  it('refuses a model the provider does not offer, listing its models', async () => {
    const { commandBus, call } = creating('full');
    const result = await call({ name: 'Scout', model: 'gpt-9' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('GLM has no model "gpt-9". Its models: glm-5.3.');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('puts it in a group of the owner’s, by id or by name whatever its case', async () => {
    const { command, call } = creating('full');
    await call({ name: 'Scout', group: research.id });
    await call({ name: 'Scout', group: 'RESEARCH' });
    expect(command(0).input.groupId).toBe(research.id);
    expect(command(1).input.groupId).toBe(research.id);
  });

  it('refuses a group the owner does not have, naming the ones they do, and creates nothing', async () => {
    const { commandBus, call } = creating('full');
    const result = await call({ name: 'Scout', group: 'Sales' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('no bot group "Sales". Its groups: "Research".');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('gives a bot made by one under Full access Approve for me unless asked, and Full access when asked', async () => {
    const { command, call } = creating('full');
    await call({ name: 'Scout' });
    await call({ name: 'Scout', permission: 'full' });
    expect(command(0).permission).toBe('auto');
    expect(command(1).permission).toBe('full');
  });

  it('refuses Full access to a bot made by one under Approve for me, raising no card', async () => {
    const { approvals, commandBus, call } = creating('auto');
    const result = await call({ name: 'Scout', permission: 'full' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('You run under Approve for me');
    expect(approvals.request).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('holds the ceiling on an approved call too, against the creator as it is now', async () => {
    const { commandBus, approved } = creating('full', { creatorPermission: 'auto' });
    const result = await approved({ name: 'Scout', permission: 'full' }, 'approval-9');
    expect(result.isError).toBe(true);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('stores the card’s defaults with the call, so a yes creates what the card showed after the creator moved on', async () => {
    const asking = creating('auto');
    await asking.call({ name: 'Scout' });
    const stored = asking.approvals.request.mock.calls[0][0].input;
    expect(stored).toEqual({
      name: 'Scout',
      provider: 'glm',
      model: 'glm-5.3',
      effort: 'high',
      permission: 'auto',
    });

    // While the card waits, the creator moves to Anthropic.
    const later = creating('auto');
    later.queryBus.execute.mockImplementation(async (query: unknown) => {
      if (query instanceof FindModelProviderCredentialsQuery) {
        return [{ provider: 'glm' }, { provider: 'anthropic' }];
      }
      if (query instanceof FindBotQuery && query.botId === SELF_ID) {
        const moved = creator('auto');
        moved.edit({ provider: 'anthropic' });
        return moved;
      }
      return created(later.command());
    });
    await later.approved(stored, 'approval-7');
    expect(later.command().input.provider).toBe('glm');
    expect(later.command()).toMatchObject({ model: 'glm-5.3', effort: 'high' });
  });

  it('stores the provider’s default model as null when the card showed it', async () => {
    const { approvals, call } = creating('auto');
    await call({ name: 'Scout', provider: 'anthropic' });
    expect(approvals.request.mock.calls[0][0].input).toMatchObject({
      provider: 'anthropic',
      model: null,
      effort: null,
    });
  });

  it('keys an approved call by its approval, so a retried job creates one bot', async () => {
    const { command, approved } = creating('auto');
    await approved({ name: 'Scout' }, 'approval-9');
    await approved({ name: 'Scout' }, 'approval-9');
    expect(command(0).idempotencyKey).toBe('bot:approval:approval-9');
    expect(command(1).idempotencyKey).toBe('bot:approval:approval-9');
  });

  it('keys a direct call by its turn and input: the same call twice is one bot, another is another', async () => {
    const { command, call } = creating('full');
    await call({ name: 'Scout' });
    await call({ name: 'Scout' });
    await call({ name: 'Scribe' });
    const keys = [0, 1, 2].map((index) => command(index).idempotencyKey);
    expect(keys[0]).toMatch(/^bot:turn-1:[0-9a-f]{32}$/);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });
});

describe('delete_bot', () => {
  const grace = bot(PEER_ID, 'Grace', 'Reviews pull requests');

  function deleting(
    permission: BotToolContext['permission'],
    options: { exists?: () => boolean; busy?: boolean; ownerMay?: boolean } = {},
  ) {
    const exists = options.exists ?? (() => true);
    const queryBus = {
      execute: vi.fn(async (query: unknown) => {
        if (query instanceof FindBotQuery && query.botId === PEER_ID && exists()) return grace;
        throw new AppError(BotErrors.NOT_FOUND);
      }),
    };
    const commandBus = { execute: vi.fn(async () => PEER_ID) };
    const running = BotTurnEntity.queue({
      organizationId: 'org-1',
      botId: PEER_ID,
      requestedByUserId: 'owner-1',
      provider: 'glm',
      model: 'glm-5.3',
      effort: null,
      timeZone: null,
      credentialScopes: null,
    });
    const turns = {
      findForConversation: vi.fn(async () => (options.busy ? [running] : [])),
    };
    const abilities = { may: vi.fn(async () => options.ownerMay ?? true) };
    const approvals = {
      request: vi.fn<BotApprovalRequesterPort['request']>(async () => ({
        status: 'requested',
        approvalId: 'approval-1',
      })),
    };
    const factory = new BotPeerToolsFactory(
      queryBus as unknown as QueryBus,
      commandBus as unknown as CommandBus,
      turns as unknown as BotTurnRepositoryPort,
      abilities as unknown as BotActorAbilityResolver,
    );
    const definition = factory.definitions().find((candidate) => candidate.name === 'delete_bot');
    if (!definition) throw new Error('no delete_bot');
    const call = (input: unknown) =>
      definition
        .bind({ ...context, permission, approvals })
        .run(input, { signal: new AbortController().signal });
    const approved = (input: Record<string, unknown>) =>
      definition.runApproved(
        input,
        { ...context, permission, approvalId: 'approval-1' },
        new AbortController().signal,
      );
    return { definition, commandBus, turns, abilities, approvals, call, approved };
  }

  it('is a bots:write tool held to the delete Bot rule its route checks', () => {
    const { definition } = deleting('auto');
    expect(definition.scope).toBe('bots:write');
    expect(definition.policy).toEqual({ action: 'delete', subject: 'Bot' });
  });

  it('always asks, under Full access too: a card naming the bot, for 15 minutes, nothing deleted', async () => {
    const { commandBus, approvals, abilities, call } = deleting('full');
    const result = await call({ bot_id: PEER_ID, name: 'Grace' });
    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'delete_bot',
        input: { bot_id: PEER_ID, name: 'Grace' },
        summary: `Delete bot "Grace" for good, with its soul, instructions, memory and chat (${PEER_ID})`,
        ttlMs: 15 * 60 * 1000,
      }),
    );
    expect(abilities.may).toHaveBeenCalledWith(
      'org-1',
      'owner-1',
      {
        action: 'delete',
        subject: 'Bot',
      },
      { id: PEER_ID, organizationId: 'org-1' },
    );
    expect(result.content).toContain('End your turn now');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('refuses to delete itself, the bot the person is talking to, raising no card', async () => {
    const { approvals, call } = deleting('auto');
    const result = await call({ bot_id: SELF_ID, name: 'Ada' });
    expect(result).toMatchObject({ isError: true });
    expect(result.content).toContain('you cannot delete yourself');
    expect(approvals.request).not.toHaveBeenCalled();
  });

  it('refuses a name that is not the bot’s, naming the one it has, raising no card', async () => {
    const { approvals, call } = deleting('auto');
    const result = await call({ bot_id: PEER_ID, name: 'grace' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain(`bot ${PEER_ID} is named "Grace", not "grace"`);
    expect(approvals.request).not.toHaveBeenCalled();
  });

  it('refuses a bot the workspace does not have, raising no card', async () => {
    const { approvals, call } = deleting('auto', { exists: () => false });
    const result = await call({ bot_id: PEER_ID, name: 'Grace' });
    expect(result.content).toContain(`the workspace has no bot ${PEER_ID}`);
    expect(approvals.request).not.toHaveBeenCalled();
  });

  it('refuses a bot that is answering right now, raising no card', async () => {
    const { approvals, call } = deleting('auto', { busy: true });
    const result = await call({ bot_id: PEER_ID, name: 'Grace' });
    expect(result.content).toContain('"Grace" is answering right now');
    expect(approvals.request).not.toHaveBeenCalled();
  });

  it('refuses for an owner who may not delete bots, raising no card', async () => {
    const { approvals, call } = deleting('auto', { ownerMay: false });
    const result = await call({ bot_id: PEER_ID, name: 'Grace' });
    expect(result.content).toContain('may not delete bots');
    expect(approvals.request).not.toHaveBeenCalled();
  });

  it('deletes it on the approved call, as the owner, with the console’s own command', async () => {
    const { commandBus, approved } = deleting('auto');
    const result = await approved({ bot_id: PEER_ID, name: 'Grace' });
    expect(result).toEqual({
      content: `Deleted bot ${PEER_ID} "Grace", with its soul, instructions, memory and chat. It cannot be brought back.`,
      isError: false,
    });
    const command = commandBus.execute.mock.calls[0][0] as unknown as DeleteBotCommand;
    expect(command).toBeInstanceOf(DeleteBotCommand);
    expect(command).toMatchObject({ scope: owner, botId: PEER_ID });
  });

  it('checks again when the approved call runs: a bot busy by then is not deleted', async () => {
    const { commandBus, approved } = deleting('auto', { busy: true });
    const result = await approved({ bot_id: PEER_ID, name: 'Grace' });
    expect(result.isError).toBe(true);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('answers an approved call run again after the bot is gone as done, deleting nothing', async () => {
    const { commandBus, approved } = deleting('auto', { exists: () => false });
    const result = await approved({ bot_id: PEER_ID, name: 'Grace' });
    expect(result).toEqual({
      content: `Bot ${PEER_ID} "Grace" is already gone; nothing more to delete.`,
      isError: false,
    });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('refuses itself on an approved call too', async () => {
    const { commandBus, approved } = deleting('auto');
    const result = await approved({ bot_id: SELF_ID, name: 'Ada' });
    expect(result.isError).toBe(true);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
