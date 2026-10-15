import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { BOT_AVATAR_COLORS, botSoulFor } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import type { HostAccessPort } from '../../../../hosts/application/host-access.port';
import type { BotRepositoryPort } from '../../../database/bot.repository.port';
import type { BotGroupRepositoryPort } from '../../../database/bot-group.repository.port';
import type { BotEntity } from '../../../domain/bot.entity';
import type { BotDocumentEntity } from '../../../domain/bot-document.entity';
import { BotGroupEntity } from '../../../domain/bot-group.entity';
import { CreateBotCommand } from '../create-bot.command';
import { CreateBotCommandHandler } from '../create-bot.command-handler';

/**
 * New bot (`product/versions/mvp/25-bots.md` §2): a numbered default name, a
 * soul that says it, empty instructions, both at revision 1, and every id it
 * names checked as the caller before anything is written. The write itself is
 * the integration spec's.
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

function setup(names: string[] = []) {
  const bots = {
    namesIn: vi.fn(async () => names),
    insert: vi.fn<BotRepositoryPort['insert']>(async () => 'saved'),
  } satisfies Pick<BotRepositoryPort, 'namesIn' | 'insert'>;
  const groups = {
    findOneById: vi.fn<BotGroupRepositoryPort['findOneById']>(async () => None),
  } satisfies Pick<BotGroupRepositoryPort, 'findOneById'>;
  const hosts = {
    assertUsable: vi.fn<HostAccessPort['assertUsable']>(async () => ({ probedTools: null })),
  } satisfies HostAccessPort;
  const handler = new CreateBotCommandHandler(
    bots as unknown as BotRepositoryPort,
    groups as unknown as BotGroupRepositoryPort,
    hosts,
  );
  const written = () => {
    const [bot, documents] = bots.insert.mock.calls[0] as [BotEntity, BotDocumentEntity[]];
    return { bot, documents };
  };
  return { handler, bots, groups, hosts, written };
}

describe('CreateBotCommandHandler', () => {
  it('names a blank bot "New Bot", numbered past the ones the workspace has, on the next colour', async () => {
    const { handler, written } = setup(['New Bot', 'Release manager']);
    await handler.execute(new CreateBotCommand({ scope: scope(), input: {} }));
    const { bot } = written();
    expect(bot.name).toBe('New Bot 2');
    expect(bot.avatarColor).toBe(BOT_AVATAR_COLORS[2]);
    expect(bot.createdByUserId).toBe(userId);
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
});
