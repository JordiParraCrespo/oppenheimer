import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import {
  BOT_AVATAR_COLORS,
  type BotProvider,
  botDefaultModel,
  botSoulFor,
} from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import type { HostAccessPort } from '../../../../hosts/application/host-access.port';
import type { BotRepositoryPort } from '../../../database/bot.repository.port';
import type { BotGroupRepositoryPort } from '../../../database/bot-group.repository.port';
import type { BotEntity } from '../../../domain/bot.entity';
import { BotEntity as Bot } from '../../../domain/bot.entity';
import type { BotDocumentEntity } from '../../../domain/bot-document.entity';
import { BotGroupEntity } from '../../../domain/bot-group.entity';
import type { ModelProviderCredentialEntity } from '../../../domain/model-provider-credential.entity';
import { CreateBotCommand } from '../create-bot.command';
import { CreateBotCommandHandler } from '../create-bot.command-handler';

/**
 * New bot (`product/versions/mvp/25-bots.md` §2): a numbered default name, a
 * soul that says it, empty instructions, both at revision 1, and every id it
 * names checked as the caller before anything is written. A bot creating one
 * (`create_bot`, §4.6) also sets its engine, its level and both documents,
 * marks it as its own, is held to its own level, and creates once per key.
 * The write itself, and two racing creations, are the integration spec's.
 */
const userId = randomUUID();
const organizationId = randomUUID();
const scope = (overrides: Partial<AccessScope> = {}): AccessScope => ({
  userId,
  organizationId,
  teamIds: [],
  grants: new Map(),
  bypass: false,
  ...overrides,
});

function setup(names: string[] = [], keyed: BotProvider[] = []) {
  const bots = {
    namesIn: vi.fn(async () => names),
    insert: vi.fn<BotRepositoryPort['insert']>(async () => 'saved'),
    findOneById: vi.fn<BotRepositoryPort['findOneById']>(async () => None),
    findOneByIdempotencyKey: vi.fn<BotRepositoryPort['findOneByIdempotencyKey']>(async () => None),
  } satisfies Pick<
    BotRepositoryPort,
    'namesIn' | 'insert' | 'findOneById' | 'findOneByIdempotencyKey'
  >;
  const groups = {
    findOneById: vi.fn<BotGroupRepositoryPort['findOneById']>(async () => None),
  } satisfies Pick<BotGroupRepositoryPort, 'findOneById'>;
  const hosts = {
    assertUsable: vi.fn<HostAccessPort['assertUsable']>(async () => ({ probedTools: null })),
  } satisfies HostAccessPort;
  const credentials = {
    findAll: vi.fn(async () =>
      keyed.map((provider) => ({ provider }) as ModelProviderCredentialEntity),
    ),
  };
  const handler = new CreateBotCommandHandler(
    bots as unknown as BotRepositoryPort,
    groups as unknown as BotGroupRepositoryPort,
    hosts,
    credentials,
  );
  const written = () => {
    const [bot, documents] = bots.insert.mock.calls[0] as [BotEntity, BotDocumentEntity[]];
    return { bot, documents };
  };
  return { handler, bots, groups, hosts, written };
}

describe('CreateBotCommandHandler', () => {
  it('starts a bot with no provider named on one the workspace has a key for', async () => {
    const { handler, written } = setup([], ['openai']);
    await handler.execute(new CreateBotCommand({ scope: scope(), input: {} }));
    expect(written().bot.provider).toBe('openai');
  });

  it('keeps Anthropic when it has a key, when no provider has one, or when a model is named', async () => {
    for (const [keyed, model] of [
      [['glm', 'anthropic'], undefined],
      [[], undefined],
      [['openai'], botDefaultModel('anthropic').id],
    ] as const) {
      const { handler, written } = setup([], [...keyed]);
      await handler.execute(new CreateBotCommand({ scope: scope(), input: {}, model }));
      expect(written().bot.provider).toBe('anthropic');
    }
  });

  it('keeps the provider it is given, key or none', async () => {
    const { handler, written } = setup([], ['openai']);
    await handler.execute(new CreateBotCommand({ scope: scope(), input: { provider: 'glm' } }));
    expect(written().bot.provider).toBe('glm');
  });

  it('gives a blank bot a first name the workspace does not have yet, on the next colour', async () => {
    const { handler, written } = setup(['Juno', 'Release manager']);
    await handler.execute(new CreateBotCommand({ scope: scope(), input: {} }));
    const { bot } = written();
    expect(bot.name).toBe('Milo');
    expect(bot.avatarColor).toBe(BOT_AVATAR_COLORS[2]);
    expect(bot.createdByUserId).toBe(userId);
  });

  it('numbers a name it is given when the workspace already has it', async () => {
    const { handler, written } = setup(['Scout']);
    await handler.execute(new CreateBotCommand({ scope: scope(), input: { name: 'Scout' } }));
    expect(written().bot.name).toBe('Scout 2');
  });

  it('writes a soul that says its name and empty instructions, both at revision 1 by the caller', async () => {
    const { handler, written } = setup();
    await handler.execute(new CreateBotCommand({ scope: scope(), input: { name: 'Ana' } }));
    const { bot, documents } = written();
    expect(
      documents.map((document) => ({
        name: document.name,
        content: document.content,
        revision: document.pendingRevision?.revision,
        authorUserId: document.pendingRevision?.authorUserId,
      })),
    ).toEqual([
      { name: 'soul', content: botSoulFor('Ana'), revision: 1, authorUserId: userId },
      { name: 'instructions', content: '', revision: 1, authorUserId: userId },
    ]);
    expect(documents.every((document) => document.botId === bot.id)).toBe(true);
  });

  it('refuses a group the workspace does not have with BOTS_003 and writes nothing', async () => {
    const { handler, bots } = setup();
    await expect(
      handler.execute(new CreateBotCommand({ scope: scope(), input: { groupId: randomUUID() } })),
    ).rejects.toMatchObject({ code: 'BOTS_003' });
    expect(bots.insert).not.toHaveBeenCalled();
  });

  it('places it in a group the workspace has', async () => {
    const { handler, groups, written } = setup();
    const group = BotGroupEntity.createNew({ organizationId, name: 'Engineering' });
    groups.findOneById.mockResolvedValueOnce(Some(group));
    await handler.execute(new CreateBotCommand({ scope: scope(), input: { groupId: group.id } }));
    expect(written().bot).toMatchObject({ groupId: group.id, placement: 'last' });
  });

  it('asks the hosts module whether the caller may use the home host, and writes nothing when not', async () => {
    const { handler, bots, hosts } = setup();
    const hostId = randomUUID();
    hosts.assertUsable.mockRejectedValueOnce(Object.assign(new Error(), { code: 'HOSTS_001' }));
    await expect(
      handler.execute(new CreateBotCommand({ scope: scope(), input: { homeHostId: hostId } })),
    ).rejects.toMatchObject({ code: 'HOSTS_001' });
    expect(hosts.assertUsable).toHaveBeenCalledWith(expect.objectContaining({ userId }), hostId);
    expect(bots.insert).not.toHaveBeenCalled();
  });

  it('refuses a caller with no workspace with BOTS_002', async () => {
    const { handler, bots } = setup();
    await expect(
      handler.execute(new CreateBotCommand({ scope: scope({ organizationId: null }), input: {} })),
    ).rejects.toMatchObject({ code: 'BOTS_002' });
    expect(bots.insert).not.toHaveBeenCalled();
  });

  describe('made by a bot', () => {
    const creatorOn = (permission: Bot['permission']) =>
      Bot.createNew({
        organizationId,
        createdByUserId: userId,
        name: 'Ada',
        description: '',
        avatarColor: 'mint',
        groupId: null,
        homeHostId: null,
        provider: 'glm',
        permission,
      });
    type Extras = Omit<ConstructorParameters<typeof CreateBotCommand>[0], 'scope' | 'input'>;
    const extras = (creator: Bot, overrides: Partial<Extras> = {}): Extras => ({
      creatorBotId: creator.id,
      idempotencyKey: 'bot:approval:approval-1',
      model: 'glm-5.3',
      effort: 'low',
      permission: 'auto',
      ...overrides,
    });

    it('is the caller’s, marked as the creator’s, on the engine and level it was given, with its documents', async () => {
      const { handler, bots, written } = setup();
      const creator = creatorOn('full');
      bots.findOneById.mockResolvedValueOnce(Some(creator));
      await handler.execute(
        new CreateBotCommand({
          scope: scope(),
          input: { name: 'Scout', provider: 'glm' },
          ...extras(creator, {
            permission: 'full',
            soul: 'You are Scout.',
            instructions: 'Read papers.',
          }),
        }),
      );
      const { bot, documents } = written();
      expect(bot).toMatchObject({
        createdByUserId: userId,
        createdByBotId: creator.id,
        idempotencyKey: 'bot:approval:approval-1',
        provider: 'glm',
        model: 'glm-5.3',
        effort: 'low',
        permission: 'full',
      });
      expect(documents.map((document) => [document.name, document.content])).toEqual([
        ['soul', 'You are Scout.'],
        ['instructions', 'Read papers.'],
      ]);
      expect(documents[0].pendingRevision?.authorUserId).toBe(userId);
    });

    it('holds the insert to the creator’s level as checked, and refuses when it changed before the write', async () => {
      const { handler, bots } = setup();
      const creator = creatorOn('full');
      bots.findOneById.mockResolvedValueOnce(Some(creator));
      bots.insert.mockResolvedValueOnce('creator-changed');
      await expect(
        handler.execute(
          new CreateBotCommand({
            scope: scope(),
            input: { name: 'Scout', provider: 'glm' },
            ...extras(creator, { permission: 'full' }),
          }),
        ),
      ).rejects.toMatchObject({ code: 'GENERIC.ARGUMENT_INVALID' });
      expect(bots.insert.mock.calls[0][2]).toEqual({ botId: creator.id, permission: 'full' });
    });

    it('lets the console create with none of it: no creator check, no key lookup', async () => {
      const { handler, bots } = setup();
      await handler.execute(new CreateBotCommand({ scope: scope(), input: { name: 'Ana' } }));
      expect(bots.findOneByIdempotencyKey).not.toHaveBeenCalled();
      expect(bots.findOneById).not.toHaveBeenCalled();
      expect(bots.insert.mock.calls[0][2]).toBeUndefined();
    });

    it('refuses a level looser than the creator’s and writes nothing', async () => {
      const { handler, bots } = setup();
      const creator = creatorOn('auto');
      bots.findOneById.mockResolvedValueOnce(Some(creator));
      await expect(
        handler.execute(
          new CreateBotCommand({
            scope: scope(),
            input: { name: 'Scout' },
            ...extras(creator, { permission: 'full' }),
          }),
        ),
      ).rejects.toMatchObject({ code: 'GENERIC.ARGUMENT_INVALID' });
      expect(bots.insert).not.toHaveBeenCalled();
    });

    it('refuses a creator the caller cannot see with BOTS_001 and writes nothing', async () => {
      const { handler, bots } = setup();
      await expect(
        handler.execute(
          new CreateBotCommand({
            scope: scope(),
            input: { name: 'Scout' },
            ...extras(creatorOn('full')),
          }),
        ),
      ).rejects.toMatchObject({ code: 'BOTS_001' });
      expect(bots.insert).not.toHaveBeenCalled();
    });

    it('answers the bot a landed attempt with the same key made, writing nothing and checking nothing again', async () => {
      const { handler, bots } = setup();
      const earlier = creatorOn('auto');
      bots.findOneByIdempotencyKey.mockResolvedValueOnce(Some(earlier));
      const id = await handler.execute(
        new CreateBotCommand({
          scope: scope(),
          input: { name: 'Scout' },
          ...extras(creatorOn('auto')),
        }),
      );
      expect(id).toBe(earlier.id);
      expect(bots.findOneByIdempotencyKey).toHaveBeenCalledWith(
        expect.objectContaining({ userId }),
        'bot:approval:approval-1',
      );
      expect(bots.findOneById).not.toHaveBeenCalled();
      expect(bots.insert).not.toHaveBeenCalled();
    });

    it('answers the bot a racing attempt made when its own insert lost on the key', async () => {
      const { handler, bots } = setup();
      const creator = creatorOn('auto');
      const winner = creatorOn('auto');
      bots.findOneById.mockResolvedValueOnce(Some(creator));
      bots.insert.mockResolvedValueOnce('taken');
      bots.findOneByIdempotencyKey.mockResolvedValueOnce(None).mockResolvedValueOnce(Some(winner));
      const id = await handler.execute(
        new CreateBotCommand({
          scope: scope(),
          input: { name: 'Scout', provider: 'glm' },
          ...extras(creator),
        }),
      );
      expect(id).toBe(winner.id);
    });
  });
});
