import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import type { BotLookupPort } from '../../../../bots/application/bot-lookup.port';
import { BotEntity } from '../../../../bots/domain/bot.entity';
import type { BotAttachmentRepositoryPort } from '../../../database/bot-attachment.repository.port';
import type { BotAttachmentEntity } from '../../../domain/bot-attachment.entity';
import type { BotAttachmentFilesPort } from '../../../infrastructure/bot-attachment-files.port';
import { UploadBotAttachmentCommand } from '../upload-bot-attachment.command';
import { UploadBotAttachmentCommandHandler } from '../upload-bot-attachment.command-handler';

/**
 * An image picked in a bot's composer: known by its bytes, never by the type
 * the browser claimed; stored under a key naming the workspace and the bot;
 * refused, with nothing stored, when it is not an image a bot takes, too
 * large, or for a bot whose model reads no images.
 */
const scope: AccessScope = {
  userId: randomUUID(),
  organizationId: randomUUID(),
  teamIds: [],
  grants: new Map(),
  bypass: false,
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);

function setup(provider: BotEntity['provider'] = 'anthropic') {
  const bot = BotEntity.createNew({
    organizationId: scope.organizationId as string,
    createdByUserId: scope.userId,
    name: 'Ada',
    description: '',
    avatarColor: 'mint',
    groupId: null,
    homeHostId: null,
    provider,
  });
  const attachments = {
    insert: vi.fn(async (_attachment: BotAttachmentEntity) => undefined),
  } satisfies Partial<BotAttachmentRepositoryPort>;
  const files = {
    store: vi.fn(async (_key: string, _file: Buffer, _mimeType: string) => undefined),
    read: vi.fn(),
    remove: vi.fn(async () => undefined),
  } satisfies BotAttachmentFilesPort;
  const handler = new UploadBotAttachmentCommandHandler(
    { bot: async () => bot } satisfies BotLookupPort,
    attachments as unknown as BotAttachmentRepositoryPort,
    files,
  );
  const upload = (file: Buffer, name = 'screenshot.png') =>
    handler.execute(new UploadBotAttachmentCommand({ scope, botId: bot.id, file, name }));
  return { bot, attachments, files, upload };
}

describe('UploadBotAttachmentCommandHandler', () => {
  it('stores the image by the type its bytes declare, under the workspace and the bot', async () => {
    const { bot, attachments, files, upload } = setup();

    const id = await upload(JPEG, 'C:\\Users\\ada\\photo.png');

    const [stored] = attachments.insert.mock.calls[0];
    expect(stored).toMatchObject({
      id,
      mimeType: 'image/jpeg',
      sizeBytes: JPEG.length,
      name: 'photo.png',
      messageId: null,
      uploadedByUserId: scope.userId,
      storageKey: `bot-attachments/${bot.organizationId}/${bot.id}/${id}.jpg`,
    });
    expect(files.store).toHaveBeenCalledWith(stored.storageKey, JPEG, 'image/jpeg');
  });

  it('refuses a file that is not a PNG, JPEG, GIF or WebP with BOTS_024, storing nothing', async () => {
    const { attachments, files, upload } = setup();
    await expect(upload(Buffer.from('<svg onload="x()"/>'), 'x.png')).rejects.toMatchObject({
      code: 'BOTS_024',
    });
    await expect(upload(Buffer.from('%PDF-1.7'), 'x.pdf')).rejects.toMatchObject({
      code: 'BOTS_024',
    });
    expect(files.store).not.toHaveBeenCalled();
    expect(attachments.insert).not.toHaveBeenCalled();
  });

  it('refuses an image past 5 MB with BOTS_025', async () => {
    const { files, upload } = setup();
    const large = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    await expect(upload(large)).rejects.toMatchObject({ code: 'BOTS_025' });
    expect(files.store).not.toHaveBeenCalled();
  });

  it('refuses any image for a bot whose model reads none with BOTS_028', async () => {
    const { files, upload } = setup('glm');
    await expect(upload(PNG)).rejects.toMatchObject({ code: 'BOTS_028' });
    expect(files.store).not.toHaveBeenCalled();
  });

  it('deletes the stored file when its row cannot be written', async () => {
    const { attachments, files, upload } = setup();
    attachments.insert.mockRejectedValueOnce(new Error('connection reset'));
    await expect(upload(PNG)).rejects.toThrow('connection reset');
    expect(files.remove).toHaveBeenCalledWith(files.store.mock.calls[0][0]);
  });
});
