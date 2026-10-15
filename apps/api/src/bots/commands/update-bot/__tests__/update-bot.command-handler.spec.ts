import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import type { HostAccessPort } from '../../../../hosts/application/host-access.port';
import { BotLookupResolver } from '../../../application/bot-lookup.resolver';
import type { BotRepositoryPort } from '../../../database/bot.repository.port';
import type { BotGroupRepositoryPort } from '../../../database/bot-group.repository.port';
import { BotEntity } from '../../../domain/bot.entity';
import { BotGroupEntity } from '../../../domain/bot-group.entity';
import { UpdateBotCommand } from '../update-bot.command';
import { UpdateBotCommandHandler } from '../update-bot.command-handler';

/**
 * Editing a bot: what it names is checked as the caller before the write, and
 * a move says where the bot lands. The renumbering is the integration spec's.
 */
const userId = randomUUID();
const organizationId = randomUUID();
const scope: AccessScope = {
  userId,
  organizationId,
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function setup() {
  const bot = BotEntity.createNew({
    organizationId,
    createdByUserId: userId,
    name: 'Ana',
    description: '',
    avatarColor: 'mint',
    groupId: null,
    homeHostId: null,
    provider: 'anthropic',
  });
  bot.placed(0);
  const bots = {
    findOneById: vi.fn<BotRepositoryPort['findOneById']>(async () => Some(bot)),
    save: vi.fn<BotRepositoryPort['save']>(async () => 'saved'),
  } satisfies Pick<BotRepositoryPort, 'findOneById' | 'save'>;
  const groups = {
    findOneById: vi.fn<BotGroupRepositoryPort['findOneById']>(async () => None),
  } satisfies Pick<BotGroupRepositoryPort, 'findOneById'>;
  const hosts = {
    assertUsable: vi.fn<HostAccessPort['assertUsable']>(async () => ({ probedTools: null })),
  } satisfies HostAccessPort;
  const handler = new UpdateBotCommandHandler(
    new BotLookupResolver(bots as unknown as BotRepositoryPort),
    bots as unknown as BotRepositoryPort,
    groups as unknown as BotGroupRepositoryPort,
    hosts,
  );
  const update = (input: UpdateBotCommand['input']) =>
    handler.execute(new UpdateBotCommand({ scope, botId: bot.id, input }));
  return { bot, bots, groups, hosts, update };
}

describe('UpdateBotCommandHandler', () => {
  it('moves the bot last into a group the workspace has', async () => {
    const { bot, bots, groups, update } = setup();
    const group = BotGroupEntity.createNew({ organizationId, name: 'Ops' });
    groups.findOneById.mockResolvedValueOnce(Some(group));
    await update({ groupId: group.id });
    expect(bots.save).toHaveBeenCalledWith(bot);
    expect(bot).toMatchObject({ groupId: group.id, placement: 'last' });
  });

  it('refuses a group the workspace does not have with BOTS_003 and writes nothing', async () => {
    const { bots, update } = setup();
    await expect(update({ groupId: randomUUID() })).rejects.toMatchObject({ code: 'BOTS_003' });
    expect(bots.save).not.toHaveBeenCalled();
  });

  it('refuses a model Claude Code does not list with BOTS_010 and writes nothing', async () => {
    const { bots, update } = setup();
    await expect(update({ model: 'gpt-5.6-sol' })).rejects.toMatchObject({ code: 'BOTS_010' });
    expect(bots.save).not.toHaveBeenCalled();
  });

  it('checks a new home host as the caller, and clearing one asks nothing', async () => {
    const { bot, hosts, update } = setup();
    const hostId = randomUUID();
    await update({ homeHostId: hostId });
    expect(hosts.assertUsable).toHaveBeenCalledWith(scope, hostId);
    await update({ homeHostId: null });
    expect(hosts.assertUsable).toHaveBeenCalledTimes(1);
    expect(bot.homeHostId).toBeNull();
  });

  it('answers BOTS_001 when the bot was deleted under the write', async () => {
    const { bots, update } = setup();
    bots.save.mockResolvedValueOnce('missing');
    await expect(update({ name: 'Bea' })).rejects.toMatchObject({ code: 'BOTS_001' });
  });
});
