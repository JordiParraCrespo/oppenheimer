import { randomUUID } from 'node:crypto';
import type { BotPeerMessageEvent } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import type { AccessScope } from '../../../../authz/domain/access-scope.types';
import type { BotLookupPort } from '../../../../bots/application/bot-lookup.port';
import type { ModelProviderCredentialRepositoryPort } from '../../../../bots/database/model-provider-credential.repository.port';
import { BotEntity } from '../../../../bots/domain/bot.entity';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import type { BotChainState, BotChainVerdict } from '../../../domain/bot-chain.policy';
import type { BotMessageEntity } from '../../../domain/bot-message.entity';
import { BotTurnEntity } from '../../../domain/bot-turn.entity';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { SendBotPeerMessageCommand } from '../send-bot-peer-message.command';
import { SendBotPeerMessageCommandHandler } from '../send-bot-peer-message.command-handler';

/**
 * A bot's message to another: the sender is the turn that made the call and
 * its bot, as read here, never what the call claims; a message holding a
 * credential, one from a turn that is not running, and one to a bot whose
 * provider has no key are refused with nothing queued; otherwise the turn is
 * queued on the receiving bot's engine with the chain policy deciding under
 * the repository's lock. The lock and the chain's state are the integration
 * spec's.
 */
const owner: AccessScope = {
  userId: randomUUID(),
  organizationId: randomUUID(),
  teamIds: [],
  grants: new Map(),
  bypass: false,
};
const organizationId = owner.organizationId as string;

function bot(name: string, provider: 'glm' | 'anthropic'): BotEntity {
  return BotEntity.createNew({
    organizationId,
    createdByUserId: owner.userId,
    name,
    description: '',
    avatarColor: 'mint',
    groupId: null,
    homeHostId: null,
    provider,
  });
}

function setup(
  options: {
    running?: boolean;
    key?: boolean;
    queued?: Awaited<ReturnType<BotTurnRepositoryPort['enqueueFromBot']>>;
    /** The chain's state, given the asking bot's and the target's ids. */
    chain?: (ids: { ada: string; grace: string }) => BotChainState;
  } = {},
) {
  const ada = bot('Ada', 'glm');
  const grace = bot('Grace', 'anthropic');
  const asking = BotTurnEntity.queue({
    organizationId,
    botId: ada.id,
    requestedByUserId: owner.userId,
    provider: 'glm',
    model: 'glm-5.3',
    effort: null,
    credentialScopes: ['bots:write'],
  });
  if (options.running ?? true) asking.start(new Date());
  const lookup: BotLookupPort = {
    bot: vi.fn(async (_scope: AccessScope, id: string) => (id === ada.id ? ada : grace)),
  };
  const credentials = {
    findOne: vi.fn(async () => ((options.key ?? true) ? Some({}) : None)),
  } as unknown as ModelProviderCredentialRepositoryPort;
  let verdict: BotChainVerdict | undefined;
  const enqueueFromBot = vi.fn(
    async (
      _turn: BotTurnEntity,
      _message: BotMessageEntity,
      _correlationId: string | null,
      decide: (state: BotChainState) => BotChainVerdict,
    ) => {
      const ids = { ada: ada.id, grace: grace.id };
      verdict = decide(options.chain ? options.chain(ids) : { bots: [ada.id], asks: 0 });
      if (!verdict.allowed) return { outcome: 'refused' as const, refusal: verdict.refusal };
      return options.queued ?? { outcome: 'staged' as const };
    },
  );
  const turns = {
    findForRun: vi.fn(async (id: string) => (id === asking.id ? Some(asking) : None)),
    enqueueFromBot,
  } satisfies Partial<BotTurnRepositoryPort>;
  const stream: BotStreamPort = { publish: vi.fn(async () => undefined), subscribe: vi.fn() };
  const handler = new SendBotPeerMessageCommandHandler(
    lookup,
    credentials,
    turns as unknown as BotTurnRepositoryPort,
    stream,
  );
  const send = (content: string, overrides: Partial<{ fromBotId: string; toBotId: string }> = {}) =>
    handler.execute(
      new SendBotPeerMessageCommand({
        owner,
        organizationId,
        fromTurnId: asking.id,
        fromBotId: overrides.fromBotId ?? ada.id,
        toBotId: overrides.toBotId ?? grace.id,
        content,
        expectsReply: true,
      }),
    );
  return { ada, grace, asking, turns, stream, send, verdict: () => verdict };
}

describe('SendBotPeerMessageCommandHandler', () => {
  it("queues the message as a turn of the other bot, on its engine, marked as from the asking turn's bot", async () => {
    const { ada, grace, asking, turns, stream, send } = setup();
    const result = await send('Which task is PR 412 linked to?');
    expect(result).toMatchObject({ sent: true, botName: 'Grace' });
    const [turn, message] = turns.enqueueFromBot.mock.calls[0];
    expect(turn).toMatchObject({
      botId: grace.id,
      provider: 'anthropic',
      lane: 'bots',
      chainId: asking.id,
      chainDepth: 1,
      askedByBotId: ada.id,
      askedByTurnId: asking.id,
      replyRequested: true,
      credentialScopes: ['bots:write'],
    });
    expect(message).toMatchObject({ role: 'event', content: 'Which task is PR 412 linked to?' });
    expect(message.event).toEqual({
      kind: 'bot_message',
      fromBotId: ada.id,
      fromBotName: 'Ada',
      expectsReply: true,
    } satisfies BotPeerMessageEvent);
    expect(stream.publish).toHaveBeenCalledWith(grace.id, {
      type: 'turn',
      turnId: turn.id,
      status: 'queued',
    });
  });

  it('refuses a message holding a credential, and queues nothing', async () => {
    const { turns, stream, send } = setup();
    const result = await send(`here: ghp_${'a'.repeat(36)}`);
    expect(result).toEqual({ sent: false, refusal: expect.stringContaining('a GitHub token') });
    expect(turns.enqueueFromBot).not.toHaveBeenCalled();
    expect(stream.publish).not.toHaveBeenCalled();
  });

  it('refuses a call whose turn is not running, or claims a bot the turn is not', async () => {
    const stopped = setup({ running: false });
    expect(await stopped.send('hi')).toMatchObject({ sent: false });
    expect(stopped.turns.enqueueFromBot).not.toHaveBeenCalled();

    const impostor = setup();
    expect(await impostor.send('hi', { fromBotId: impostor.grace.id })).toMatchObject({
      sent: false,
    });
    expect(impostor.turns.enqueueFromBot).not.toHaveBeenCalled();
  });

  it('refuses a bot whose provider the workspace has no key for, saying where to add one', async () => {
    const { turns, send } = setup({ key: false });
    const result = await send('hi');
    expect(result).toEqual({
      sent: false,
      refusal: expect.stringContaining('Settings → Model providers'),
    });
    expect(turns.enqueueFromBot).not.toHaveBeenCalled();
  });

  it('hands the chain policy the asking turn and the target, and answers its refusal', async () => {
    const { stream, send, verdict } = setup({
      chain: ({ ada, grace }) => ({ bots: [ada, grace], asks: 1 }),
    });
    const result = await send('again');
    expect(verdict()).toMatchObject({ allowed: false });
    expect(result).toEqual({ sent: false, refusal: expect.stringContaining('circle') });
    expect(stream.publish).not.toHaveBeenCalled();
  });

  it('says so when the chain was cleared or the bot deleted while it decided', async () => {
    const gone = setup({ queued: { outcome: 'chain_gone' } });
    expect(await gone.send('hi')).toEqual({
      sent: false,
      refusal: expect.stringContaining('was cleared'),
    });
    const deleted = setup({ queued: { outcome: 'missing' } });
    expect(await deleted.send('hi')).toEqual({ sent: false, refusal: 'Grace was deleted.' });
    expect(deleted.stream.publish).not.toHaveBeenCalled();
  });
});
