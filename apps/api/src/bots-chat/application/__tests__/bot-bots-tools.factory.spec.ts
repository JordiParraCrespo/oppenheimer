import type { QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import { BOT_AVATAR_COLORS } from '@oppenheimer/shared';
import { BotEntity } from '../../../bots/domain/bot.entity';
import { FindBotQuery } from '../../../bots/queries/find-bot/find-bot.query';
import { FindBotsQuery } from '../../../bots/queries/find-bots/find-bots.query';
import { BotPeerToolsFactory } from '../bot-bots-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

/**
 * The reads a bot learns about the workspace's other bots through: the
 * bots module's own queries in the owner's scope, answering what each bot
 * is for and what runs it, with the asking bot marked as itself.
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
  const factory = new BotPeerToolsFactory(queryBus as unknown as QueryBus);
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
