import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { None, Some } from 'oxide.ts';
import type { BotLookupResolver } from '../../../application/bot-lookup.resolver';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import type { ModelProviderCredentialRepositoryPort } from '../../../database/model-provider-credential.repository.port';
import { BotEntity } from '../../../domain/bot.entity';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import type { ProviderKeySealerPort } from '../../../infrastructure/provider-key-sealer.port';
import { SendBotMessageCommand } from '../send-bot-message.command';
import { SendBotMessageCommandHandler } from '../send-bot-message.command-handler';

/**
 * Sending a bot a message: a queued turn on the bot's provider and model as
 * they are now, with your message first, or a refusal where the person can
 * fix it — no key for the provider, no sealing key on the server — with
 * nothing queued.
 */
const scope: AccessScope = {
  userId: randomUUID(),
  organizationId: randomUUID(),
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function setup(options: { key?: boolean; sealer?: boolean } = {}) {
  const bot = BotEntity.createNew({
    organizationId: scope.organizationId as string,
    createdByUserId: scope.userId,
    name: 'Glm Bot',
    description: '',
    avatarColor: 'mint',
    groupId: null,
    homeHostId: null,
    provider: 'glm',
  });
  const turns = { enqueue: vi.fn(async () => 'staged' as const) };
  const credentials = {
    findOne: vi.fn(async () => ((options.key ?? true) ? Some({}) : None)),
  };
  const sealer = { isConfigured: () => options.sealer ?? true } as ProviderKeySealerPort;
  const stream: BotStreamPort = { publish: vi.fn(async () => undefined), subscribe: vi.fn() };
  const handler = new SendBotMessageCommandHandler(
    { bot: async () => bot } as unknown as BotLookupResolver,
    credentials as unknown as ModelProviderCredentialRepositoryPort,
    sealer,
    turns as unknown as BotTurnRepositoryPort,
    stream,
  );
  return { handler, turns, bot };
}

const send = (handler: SendBotMessageCommandHandler, botId: string) =>
  handler.execute(new SendBotMessageCommand({ scope, botId, content: 'Ship it' }));

describe('SendBotMessageCommandHandler', () => {
  it('queues a turn on the bot’s provider and default model, with the message first', async () => {
    const { handler, turns, bot } = setup();
    await send(handler, bot.id);
    const [turn, message] = vi.mocked(turns.enqueue).mock.calls[0];
    expect(turn).toMatchObject({ status: 'queued', provider: 'glm', model: 'glm-5.3' });
    expect(message).toMatchObject({
      role: 'user',
      content: 'Ship it',
      position: 0,
      turnId: turn.id,
    });
  });

  it('refuses with BOTS_013 when the workspace has no key for the provider, queuing nothing', async () => {
    const { handler, turns, bot } = setup({ key: false });
    await expect(send(handler, bot.id)).rejects.toMatchObject({ code: 'BOTS_013' });
    expect(turns.enqueue).not.toHaveBeenCalled();
  });

  it('refuses with BOTS_011 on a server with no sealing key', async () => {
    const { handler, turns, bot } = setup({ sealer: false });
    await expect(send(handler, bot.id)).rejects.toMatchObject({ code: 'BOTS_011' });
    expect(turns.enqueue).not.toHaveBeenCalled();
  });
});
