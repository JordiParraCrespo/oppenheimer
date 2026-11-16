import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { BOT_AVATAR_COLORS } from '@oppenheimer/shared';
import { CreateBotCommand } from '../../../bots/commands/create-bot/create-bot.command';
import { UpdateBotCommand } from '../../../bots/commands/update-bot/update-bot.command';
import { BotEntity } from '../../../bots/domain/bot.entity';
import { BotGroupEntity } from '../../../bots/domain/bot-group.entity';
import { FindBotQuery } from '../../../bots/queries/find-bot/find-bot.query';
import { FindBotGroupsQuery } from '../../../bots/queries/find-bot-groups/find-bot-groups.query';
import { FindBotsQuery } from '../../../bots/queries/find-bots/find-bots.query';
import { FindModelProviderCredentialsQuery } from '../../../bots/queries/find-model-provider-credentials/find-model-provider-credentials.query';
import {
  SendBotPeerMessageCommand,
  type SendBotPeerMessageResult,
} from '../../commands/send-bot-peer-message/send-bot-peer-message.command';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
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
 * once per call; and `message_bot` and `ask_bot`, which dispatch the peer
 * message command as the turn running them, say what was sent or why not,
 * and send at most five a turn. The write itself is the command's and the
 * integration spec's.
 */
const owner = emptyScope('owner-1', 'org-1');
const SELF_ID = '11111111-1111-4111-8111-111111111111';
const PEER_ID = '22222222-2222-4222-8222-222222222222';
const context: BotToolContext = {
  owner,
  organizationId: 'org-1',
  botId: SELF_ID,
  turnId: 'turn-1',
  homeHostId: null,
  timeZone: 'Europe/Madrid',
  permission: 'auto',
  permissions: NO_PERMISSIONS,
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
    const web = BotGroupEntity.createNew({ organizationId: 'org-1', name: 'Web' });
    const grace = bot(PEER_ID, 'Grace', 'Reviews pull requests');
    grace.moveTo(web.id, undefined);
    const { queryBus, call } = setup((query) =>
      query instanceof FindBotGroupsQuery ? [web] : [bot(SELF_ID, 'Ada', 'Release notes'), grace],
    );
    const result = await call('list_bots', {});
    const query = queryBus.execute.mock.calls[0][0] as FindBotsQuery;
    expect(query).toBeInstanceOf(FindBotsQuery);
    expect(query.scope).toBe(owner);
    expect(result.content).toContain(
      `${SELF_ID} "Ada" (you) [Release notes; group ungrouped; GLM GLM-5.3`,
    );
    // A bot asked to change "the web team" picks the bots by this group.
    expect(result.content).toContain(
      `${PEER_ID} "Grace" [Reviews pull requests; group "Web" (${web.id});`,
    );
  });

  it('reads one bot by id', async () => {
    const { queryBus, call } = setup((query) =>
      query instanceof FindBotGroupsQuery ? [] : bot(PEER_ID, 'Grace', 'Reviews pull requests'),
    );
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

describe('update_bot', () => {
  const ZENGUE = '44444444-4444-4444-8444-444444444444';
  const COVERD = '55555555-5555-4555-8555-555555555555';
  const web = BotGroupEntity.createNew({ organizationId: 'org-1', name: 'Web' });

  function updating(permission: BotToolContext['permission'], options: { keyed?: string[] } = {}) {
    const bots = new Map<string, BotEntity>([
      [SELF_ID, creator(permission)],
      [ZENGUE, bot(ZENGUE, 'Zengue Jewels', 'Shop')],
      [COVERD, bot(COVERD, 'Coverd Web', 'Site')],
    ]);
    const queryBus = {
      execute: vi.fn(async (query: unknown) => {
        if (query instanceof FindModelProviderCredentialsQuery) {
          return (options.keyed ?? ['glm', 'chatgpt']).map((provider) => ({ provider }));
        }
        if (query instanceof FindBotGroupsQuery) return [web];
        if (query instanceof FindBotsQuery) return [...bots.values()];
        if (query instanceof FindBotQuery) return bots.get(query.botId);
        throw new Error('unexpected query');
      }),
    };
    const commandBus = {
      execute: vi.fn(async (command: unknown) => {
        const update = command as UpdateBotCommand;
        bots.get(update.botId)?.edit(update.input);
        return update.botId;
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
    );
    const definition = factory.definitions().find((candidate) => candidate.name === 'update_bot');
    if (!definition) throw new Error('no update_bot');
    const call = (input: unknown) =>
      definition
        .bind({ ...context, permission, approvals })
        .run(input, { signal: new AbortController().signal });
    const commands = () =>
      commandBus.execute.mock.calls.map(([command]) => command as UpdateBotCommand);
    return { definition, commandBus, approvals, call, commands };
  }

  it('asks under Approve for me with a card naming every bot and the engine they move to, changing nothing', async () => {
    const { commandBus, approvals, call } = updating('auto');
    const result = await call({
      bot_ids: [ZENGUE, COVERD],
      provider: 'chatgpt',
      model: 'GPT-6.1 Sol',
    });
    expect(approvals.request).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'update_bot',
        summary: 'Update 2 bots (Zengue Jewels, Coverd Web): runs on ChatGPT GPT-6.1 Sol',
      }),
    );
    expect(result.content).toContain('End your turn now');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('moves every bot named to the model under Full access, as the owner, and answers with each as it now stands', async () => {
    const { commands, call } = updating('full');
    const result = await call({
      bot_ids: [ZENGUE, COVERD, ZENGUE],
      provider: 'chatgpt',
      model: 'gpt-6.1-sol',
    });
    expect(commands()).toHaveLength(2);
    for (const command of commands()) {
      expect(command).toBeInstanceOf(UpdateBotCommand);
      expect(command.scope).toBe(owner);
      expect(command.input).toEqual({ provider: 'chatgpt', model: 'gpt-6.1-sol' });
    }
    expect(commands().map((command) => command.botId)).toEqual([ZENGUE, COVERD]);
    expect(result.isError).toBe(false);
    expect(result.content).toContain(`${ZENGUE} "Zengue Jewels": runs on ChatGPT GPT-6.1 Sol`);
    expect(result.content).toContain(`${COVERD} "Coverd Web": runs on ChatGPT GPT-6.1 Sol`);
  });

  it('names the bots it changed and the one whose write failed, when a bot goes between the plan and the write', async () => {
    const { commandBus, call } = updating('full');
    const write = commandBus.execute.getMockImplementation();
    commandBus.execute.mockImplementation(async (command: unknown) => {
      if ((command as UpdateBotCommand).botId === COVERD) throw new Error('No bot with that id');
      return write?.(command);
    });
    const result = await call({ bot_ids: [ZENGUE, COVERD], model: 'glm-5.3' });
    expect(result.isError).toBe(false);
    expect(result.content).toContain(`Updated 1 bot:\n- ${ZENGUE} "Zengue Jewels"`);
    expect(result.content).toContain(
      `Not updated (1):\n- ${COVERD} "Coverd Web": No bot with that id`,
    );
  });

  it('stores the group the card named by id, so a rename while it waits moves no bot elsewhere', async () => {
    const { approvals, call } = updating('auto');
    await call({ bot_ids: [ZENGUE, ZENGUE], group: 'Web' });
    expect(approvals.request.mock.calls[0][0].input).toEqual({
      bot_ids: [ZENGUE],
      group: web.id,
    });
  });

  it('changes the look, group and learning of a bot, the group by name', async () => {
    const { commands, call } = updating('full');
    await call({
      bot_ids: [ZENGUE],
      name: 'Zengue',
      description: 'Runs the jewellery shop',
      avatar_color: 'coral',
      group: 'web',
      learn_automatically: false,
    });
    expect(commands()[0].input).toEqual({
      name: 'Zengue',
      description: 'Runs the jewellery shop',
      avatarColor: 'coral',
      groupId: web.id,
      learnAutomatically: false,
    });
  });

  it('refuses a provider the workspace has no key for, a model the provider lacks, or nothing to change, changing nothing', async () => {
    const { commandBus, approvals, call } = updating('auto', { keyed: ['glm'] });
    const keyless = await call({ bot_ids: [ZENGUE], provider: 'chatgpt' });
    expect(keyless.content).toContain('The workspace has no ChatGPT key');
    const unknownModel = await call({ bot_ids: [ZENGUE], model: 'gpt-9' });
    expect(unknownModel.content).toContain('For "Zengue Jewels": GLM has no model "gpt-9"');
    const empty = await call({ bot_ids: [ZENGUE] });
    expect(empty.content).toContain('Name at least one thing to change');
    expect([keyless, unknownModel, empty].every((result) => result.isError)).toBe(true);
    expect(approvals.request).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('never gives a bot looser permissions than the caller’s, and renames one bot at a time', async () => {
    const { commandBus, call } = updating('auto');
    const looser = await call({ bot_ids: [ZENGUE], permission: 'full' });
    expect(looser.content).toContain('You run under Approve for me');
    const rename = await call({ bot_ids: [ZENGUE, COVERD], name: 'Twin' });
    expect(rename.content).toContain('one bot at a time');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('refuses a bot id the workspace does not have', async () => {
    const { commandBus, call } = updating('full');
    const missing = '66666666-6666-4666-8666-666666666666';
    const result = await call({ bot_ids: [ZENGUE, missing], model: null });
    expect(result.isError).toBe(true);
    expect(result.content).toContain(`no bot ${missing}`);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});

describe('BotPeerToolsFactory: message_bot and ask_bot', () => {
  function peerSetup(result: SendBotPeerMessageResult) {
    const commandBus = { execute: vi.fn(async () => result) };
    const factory = new BotPeerToolsFactory(
      { execute: vi.fn() } as unknown as QueryBus,
      commandBus as unknown as CommandBus,
    );
    const own: BotToolContext = { ...context, budget: new BotTurnBudget() };
    const call = (name: string, input: unknown) => {
      const found = factory.definitions().find((definition) => definition.name === name);
      if (!found) throw new Error(`no tool ${name}`);
      return found.bind(own).run(input, { signal: new AbortController().signal });
    };
    return { commandBus, call };
  }

  it('sends as the turn and bot running the tool, in the owner’s scope, asking for an answer only through ask_bot', async () => {
    const { commandBus, call } = peerSetup({ sent: true, turnId: 'turn-9', botName: 'Grace' });
    const asked = await call('ask_bot', { bot_id: PEER_ID, message: '  Which task is PR 412?  ' });
    const told = await call('message_bot', {
      bot_id: PEER_ID,
      message: 'Heads-up: PR 412 merged.',
    });
    const [ask, tell] = commandBus.execute.mock.calls.map(
      ([command]) => command as SendBotPeerMessageCommand,
    );
    expect(ask).toBeInstanceOf(SendBotPeerMessageCommand);
    expect(ask).toMatchObject({
      owner,
      organizationId: 'org-1',
      fromBotId: SELF_ID,
      fromTurnId: 'turn-1',
      toBotId: PEER_ID,
      content: 'Which task is PR 412?',
      expectsReply: true,
    });
    expect(tell.expectsReply).toBe(false);
    expect(asked).toMatchObject({ isError: false });
    expect(asked.content).toContain('Its answer will arrive in this chat as a new message');
    expect(told.content).toContain('it will not reply to you');
  });

  it('answers the refusal as the tool’s error, so the bot reads why nothing was sent', async () => {
    const { call } = peerSetup({ sent: false, refusal: 'That bot is already working on this.' });
    const result = await call('ask_bot', { bot_id: PEER_ID, message: 'again' });
    expect(result).toEqual({ content: 'That bot is already working on this.', isError: true });
  });

  it('sends at most five messages to other bots a turn, either tool counting, and refuses the sixth unsent', async () => {
    const { commandBus, call } = peerSetup({ sent: true, turnId: 'turn-9', botName: 'Grace' });
    for (let i = 0; i < 5; i++) {
      const tool = i % 2 ? 'ask_bot' : 'message_bot';
      expect(await call(tool, { bot_id: PEER_ID, message: `m${i}` })).toMatchObject({
        isError: false,
      });
    }
    const sixth = await call('message_bot', { bot_id: PEER_ID, message: 'm5' });
    expect(sixth).toMatchObject({ isError: true });
    expect(sixth.content).toContain('5 messages to other bots this turn');
    expect(commandBus.execute).toHaveBeenCalledTimes(5);
  });

  it('refuses a message that is empty or not to a bot id, before anything is sent', async () => {
    const { commandBus, call } = peerSetup({ sent: true, turnId: 'turn-9', botName: 'Grace' });
    expect(await call('message_bot', { bot_id: PEER_ID, message: '   ' })).toMatchObject({
      isError: true,
    });
    expect(await call('ask_bot', { bot_id: 'Grace', message: 'hi' })).toMatchObject({
      isError: true,
    });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
