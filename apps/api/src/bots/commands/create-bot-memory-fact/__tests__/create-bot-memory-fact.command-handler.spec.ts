import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { BOT_MEMORY_FACTS_MAX } from '@oppenheimer/shared';
import { Some } from 'oxide.ts';
import { BotLookupResolver } from '../../../application/bot-lookup.resolver';
import type { BotRepositoryPort } from '../../../database/bot.repository.port';
import type { BotMemoryFactRepositoryPort } from '../../../database/bot-memory-fact.repository.port';
import { BotEntity } from '../../../domain/bot.entity';
import { CreateBotMemoryFactCommand } from '../create-bot-memory-fact.command';
import { CreateBotMemoryFactCommandHandler } from '../create-bot-memory-fact.command-handler';

/** A fact by hand, under the per-bot cap; the counted-under-lock insert is the integration spec's. */
const userId = randomUUID();
const scope: AccessScope = {
  userId,
  organizationId: randomUUID(),
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function setup() {
  const bot = BotEntity.createNew({
    organizationId: scope.organizationId as string,
    createdByUserId: userId,
    name: 'Ana',
    description: '',
    avatarColor: 'mint',
    groupId: null,
    homeHostId: null,
  });
  const bots = {
    findOneById: vi.fn<BotRepositoryPort['findOneById']>(async () => Some(bot)),
  } satisfies Pick<BotRepositoryPort, 'findOneById'>;
  const memory = {
    insert: vi.fn<BotMemoryFactRepositoryPort['insert']>(async () => 'inserted'),
  } satisfies Pick<BotMemoryFactRepositoryPort, 'insert'>;
  const handler = new CreateBotMemoryFactCommandHandler(
    new BotLookupResolver(bots as unknown as BotRepositoryPort),
    memory as unknown as BotMemoryFactRepositoryPort,
  );
  const add = (content: string) =>
    handler.execute(new CreateBotMemoryFactCommand({ scope, botId: bot.id, content }));
  return { bot, memory, add };
}

describe('CreateBotMemoryFactCommandHandler', () => {
  it('adds the fact as the caller’s, under the per-bot cap', async () => {
    const { bot, memory, add } = setup();
    await add('  Releases go out on Thursdays. ');
    const [fact, max] = memory.insert.mock.calls[0];
    expect(fact).toMatchObject({
      botId: bot.id,
      content: 'Releases go out on Thursdays.',
      source: 'user',
    });
    expect(max).toBe(BOT_MEMORY_FACTS_MAX);
  });

  it('answers BOTS_009 when the bot keeps as many facts as it may', async () => {
    const { memory, add } = setup();
    memory.insert.mockResolvedValueOnce('full');
    await expect(add('One more')).rejects.toMatchObject({ code: 'BOTS_009' });
  });
});
