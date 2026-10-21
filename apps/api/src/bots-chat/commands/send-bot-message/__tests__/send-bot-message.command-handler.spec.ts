import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { Scope } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import type { BotLookupResolver } from '../../../../bots/application/bot-lookup.resolver';
import type { ModelProviderCredentialRepositoryPort } from '../../../../bots/database/model-provider-credential.repository.port';
import { BotEntity } from '../../../../bots/domain/bot.entity';
import type { ProviderKeySealerPort } from '../../../../bots/infrastructure/provider-key-sealer.port';
import { BotMessageAttachmentsResolver } from '../../../application/bot-message-attachments.resolver';
import type { BotApprovalRepositoryPort } from '../../../database/bot-approval.repository.port';
import type { BotAttachmentRepositoryPort } from '../../../database/bot-attachment.repository.port';
import type { BotTurnRepositoryPort } from '../../../database/bot-turn.repository.port';
import { BotApprovalEntity } from '../../../domain/bot-approval.entity';
import { BotAttachmentEntity } from '../../../domain/bot-attachment.entity';
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
  options: {
    key?: boolean;
    sealer?: boolean;
    pending?: boolean;
    lost?: boolean;
    provider?: BotEntity['provider'];
  } = {},
) {
  const bot = BotEntity.createNew({
    organizationId: scope.organizationId as string,
    createdByUserId: scope.userId,
    name: 'Glm Bot',
    description: '',
    avatarColor: 'mint',
    groupId: null,
    homeHostId: null,
    provider: options.provider ?? 'glm',
  });
  const turns = { enqueue: vi.fn<BotTurnRepositoryPort['enqueue']>(async () => 'staged') };
  const uploads: BotAttachmentEntity[] = [];
  const attachments = {
    findManyForBot: vi.fn(async (_org: string, _bot: string, ids: readonly string[]) =>
      uploads.filter((upload) => ids.includes(upload.id)),
    ),
  } satisfies Partial<BotAttachmentRepositoryPort>;
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
    new BotMessageAttachmentsResolver(attachments as unknown as BotAttachmentRepositoryPort),
  );
  const upload = (props: { by?: string; sent?: boolean } = {}) => {
    const created = BotAttachmentEntity.upload(
      {
        organizationId: bot.organizationId,
        botId: bot.id,
        uploadedByUserId: props.by ?? scope.userId,
        mimeType: 'image/png',
        sizeBytes: 10,
        name: 'shot.png',
      },
      'png',
    );
    const stored = props.sent
      ? BotAttachmentEntity.create({
          id: created.id,
          props: { ...created.getProps(), messageId: randomUUID() },
        })
      : created;
    uploads.push(stored);
    return stored;
  };
  return { handler, turns, bot, approvals, card, stream, upload };
}

const send = (
  handler: SendBotMessageCommandHandler,
  botId: string,
  timeZone: string | null = null,
  credentialScopes: Scope[] | null = null,
  attachmentIds: string[] = [],
) =>
  handler.execute(
    new SendBotMessageCommand({
      scope,
      botId,
      content: 'Ship it',
      attachmentIds,
      timeZone,
      credentialScopes,
    }),
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

  it('carries your images on the message, in the order you attached them', async () => {
    const { handler, turns, bot, upload } = setup({ provider: 'anthropic' });
    const [first, second] = [upload(), upload()];
    await send(handler, bot.id, null, null, [second.id, first.id]);
    const [, message] = vi.mocked(turns.enqueue).mock.calls[0];
    expect(message.attachments.map((attachment) => attachment.id)).toEqual([second.id, first.id]);
    expect(message.attachments[0]).toEqual({
      id: second.id,
      mimeType: 'image/png',
      sizeBytes: 10,
      name: 'shot.png',
    });
  });

  it('refuses images to a bot whose model reads none with BOTS_028, queuing nothing', async () => {
    const { handler, turns, bot, upload } = setup({ provider: 'glm' });
    await expect(send(handler, bot.id, null, null, [upload().id])).rejects.toMatchObject({
      code: 'BOTS_028',
    });
    expect(turns.enqueue).not.toHaveBeenCalled();
  });

  it('refuses an image already sent with BOTS_027, and someone else’s upload as not found', async () => {
    const { handler, turns, bot, upload } = setup({ provider: 'openai' });
    await expect(
      send(handler, bot.id, null, null, [upload({ sent: true }).id]),
    ).rejects.toMatchObject({ code: 'BOTS_027' });
    await expect(
      send(handler, bot.id, null, null, [upload({ by: randomUUID() }).id]),
    ).rejects.toMatchObject({ code: 'BOTS_026' });
    await expect(send(handler, bot.id, null, null, [randomUUID()])).rejects.toMatchObject({
      code: 'BOTS_026',
    });
    expect(turns.enqueue).not.toHaveBeenCalled();
  });

  it('answers BOTS_027 when another send claimed an image first', async () => {
    const { handler, turns, bot, upload } = setup({ provider: 'chatgpt' });
    turns.enqueue.mockResolvedValueOnce('attachments_taken');
    await expect(send(handler, bot.id, null, null, [upload().id])).rejects.toMatchObject({
      code: 'BOTS_027',
    });
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
