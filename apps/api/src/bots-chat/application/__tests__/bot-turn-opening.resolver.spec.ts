import { randomUUID } from 'node:crypto';
import type { BotAttachmentRepositoryPort } from '../../database/bot-attachment.repository.port';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import { BotAttachmentEntity } from '../../domain/bot-attachment.entity';
import { BotMessageEntity } from '../../domain/bot-message.entity';
import { BotTurnEntity } from '../../domain/bot-turn.entity';
import type { BotAttachmentFilesPort } from '../../infrastructure/bot-attachment-files.port';
import { BotTurnOpeningResolver } from '../bot-turn-opening.resolver';

/**
 * What a turn is asked: the opening message's words, and the images your
 * message carried, read from storage in the order you attached them. A turn
 * with no images reads no attachment at all, and an image that cannot be
 * read fails the turn (`BOTS_026`) rather than the bot answering without it.
 */
const turn = BotTurnEntity.queue({
  organizationId: randomUUID(),
  botId: randomUUID(),
  requestedByUserId: randomUUID(),
  provider: 'anthropic',
  model: 'claude-model',
  effort: null,
});

function image(name: string, mimeType: 'image/png' | 'image/jpeg') {
  return BotAttachmentEntity.upload(
    {
      organizationId: turn.organizationId,
      botId: turn.botId,
      uploadedByUserId: randomUUID(),
      mimeType,
      sizeBytes: 3,
      name,
    },
    mimeType === 'image/png' ? 'png' : 'jpg',
  );
}

function opening(content: string, images: BotAttachmentEntity[]) {
  return BotMessageEntity.createNew({
    organizationId: turn.organizationId,
    botId: turn.botId,
    turnId: turn.id,
    role: 'user',
    content,
    steps: [],
    position: 0,
    attachments: images.map((attachment) => attachment.toMessageAttachment()),
  });
}

function setup(message: BotMessageEntity, stored: BotAttachmentEntity[], unreadable = false) {
  const messages = {
    findOpening: vi.fn(async () => message),
  } satisfies Partial<BotMessageRepositoryPort>;
  const attachments = {
    findForMessage: vi.fn(async () => stored),
  } satisfies Partial<BotAttachmentRepositoryPort>;
  const files = {
    store: vi.fn(),
    read: vi.fn(async (key: string) => {
      if (unreadable) throw new Error('NoSuchKey');
      return Buffer.from(key);
    }),
    remove: vi.fn(),
  } satisfies BotAttachmentFilesPort;
  const resolver = new BotTurnOpeningResolver(
    messages as unknown as BotMessageRepositoryPort,
    attachments as unknown as BotAttachmentRepositoryPort,
    files,
  );
  return { resolver, attachments, files };
}

describe('BotTurnOpeningResolver', () => {
  it('sends the images your message carries in the order you attached them, as base64', async () => {
    const [first, second] = [image('first.jpg', 'image/jpeg'), image('second.png', 'image/png')];
    const message = opening('What is this?', [first, second]);
    const { resolver, attachments } = setup(message, [second, first]);

    await expect(resolver.resolve(turn)).resolves.toEqual({
      prompt: 'What is this?',
      images: [
        { mimeType: 'image/jpeg', data: Buffer.from(first.storageKey).toString('base64') },
        { mimeType: 'image/png', data: Buffer.from(second.storageKey).toString('base64') },
      ],
    });
    expect(attachments.findForMessage).toHaveBeenCalledWith(turn.organizationId, message.id);
  });

  it('reads no attachment for a message without images', async () => {
    const { resolver, attachments } = setup(opening('Hi', []), []);
    await expect(resolver.resolve(turn)).resolves.toEqual({ prompt: 'Hi', images: [] });
    expect(attachments.findForMessage).not.toHaveBeenCalled();
  });

  it('fails with BOTS_026 when an image is gone from the table or from storage', async () => {
    const lost = image('lost.png', 'image/png');
    await expect(setup(opening('', [lost]), []).resolver.resolve(turn)).rejects.toMatchObject({
      code: 'BOTS_026',
    });
    await expect(
      setup(opening('', [lost]), [lost], true).resolver.resolve(turn),
    ).rejects.toMatchObject({ code: 'BOTS_026' });
  });
});
