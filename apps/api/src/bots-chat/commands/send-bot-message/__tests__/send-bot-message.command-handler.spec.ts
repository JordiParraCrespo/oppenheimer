import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Scope } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import type { BotLookupResolver } from '../../../../bots/application/bot-lookup.resolver';
import type { ModelProviderCredentialRepositoryPort } from '../../../../bots/database/model-provider-credential.repository.port';
import { BotEntity } from '../../../../bots/domain/bot.entity';
import type { ProviderKeySealerPort } from '../../../../bots/infrastructure/provider-key-sealer.port';
import type { BotApprovalRepositoryPort } from '../../../database/bot-approval.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotApprovalEntity } from '../../../domain/bot-approval.entity';
import type { BotStreamPort } from '../../../infrastructure/bot-stream.port';
import { SendBotMessageCommand } from '../send-bot-message.command';
import { SendBotMessageCommandHandler } from '../send-bot-message.command-handler';

/**
 * Sending a bot a message: a queued turn on the bot's provider and model as
 * they are now, with your message first, or a refusal where the person can
 * fix it — no key for the provider, no sealing key on the server — with
 * nothing queued. A card the bot is waiting on expires with the message.
 */
const scope: AccessScope = {
  userId: randomUUID(),
  organizationId: randomUUID(),
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

function setup(
  options: { key?: boolean; sealer?: boolean; pending?: boolean; lost?: boolean } = {},
) {
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
  const card = BotApprovalEntity.request({
    organizationId: bot.organizationId,
    botId: bot.id,
    turnId: randomUUID(),
    tool: 'start_session',
    input: { task: 'x' },
    summary: 'Start Claude Code on build-02',
  });
  const approvals = {
    findPending: vi.fn(async () => (options.pending ? Some(card) : None)),
    saveTransition: vi.fn(async () => !options.lost),
  } satisfies Partial<BotApprovalRepositoryPort>;
  const handler = new SendBotMessageCommandHandler(
    { bot: async () => bot } as unknown as BotLookupResolver,
    credentials as unknown as ModelProviderCredentialRepositoryPort,
    sealer,
    turns as unknown as BotTurnRepositoryPort,
    stream,
    approvals as unknown as BotApprovalRepositoryPort,
  );
  return { handler, turns, bot, approvals, card, stream };
}

const send = (
  handler: SendBotMessageCommandHandler,
  botId: string,
  timeZone: string | null = null,
  credentialScopes: Scope[] | null = null,
) =>
  handler.execute(
    new SendBotMessageCommand({ scope, botId, content: 'Ship it', timeZone, credentialScopes }),
  );

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

  it('keeps the sender’s time zone on the turn, so the bot is told their time', async () => {
    const { handler, turns, bot } = setup();
    await send(handler, bot.id, 'Europe/Madrid');
    const [turn] = vi.mocked(turns.enqueue).mock.calls[0];
    expect(turn.timeZone).toBe('Europe/Madrid');
  });

  it('keeps the scopes of the token it was sent with, so the turn reaches no further', async () => {
    const { handler, turns, bot } = setup();
    await send(handler, bot.id, null, ['bots:write']);
    const [turn] = vi.mocked(turns.enqueue).mock.calls[0];
    expect(turn.credentialScopes).toEqual(['bots:write']);
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

  it('expires the card the bot is waiting on: nobody decided, and an open chat is told', async () => {
    const { handler, bot, approvals, card, stream } = setup({ pending: true });
    await send(handler, bot.id);
    expect(card).toMatchObject({ status: 'expired', decidedByUserId: null });
    expect(approvals.saveTransition).toHaveBeenCalledWith(card);
    expect(stream.publish).toHaveBeenCalledWith(bot.id, {
      type: 'approval',
      approvalId: card.id,
      status: 'expired',
    });
  });

  it('announces nothing when a decision moved the card first', async () => {
    const { handler, bot, stream } = setup({ pending: true, lost: true });
    await send(handler, bot.id);
    expect(stream.publish).not.toHaveBeenCalledWith(
      bot.id,
      expect.objectContaining({ type: 'approval' }),
    );
  });
});
