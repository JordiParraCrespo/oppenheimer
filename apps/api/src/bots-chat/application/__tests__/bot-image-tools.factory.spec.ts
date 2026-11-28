import { emptyScope } from '@oppenheimer/backend-authz';
import { BOT_IMAGE_MAX_BYTES } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import { BotAttachmentMapper } from '../../bot-attachment.mapper';
import type { BotAttachmentRepositoryPort } from '../../database/bot-attachment.repository.port';
import { BotAttachmentEntity } from '../../domain/bot-attachment.entity';
import { VIEWED_IMAGES_PER_TURN } from '../../domain/bot-image-view.policy';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotAttachmentFilesPort } from '../../infrastructure/bot-attachment-files.port';
import { BotImageToolsFactory } from '../bot-image-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

/**
 * `view_image` as the model sees it: an image a message of this conversation
 * carried comes back as the call's image, for the model alone; any other id
 * (another conversation's, another bot's, an unsent upload's, one never
 * issued) is refused as not found, without reading storage; a file that is
 * gone, too large or of a type no model reads is refused in words that say
 * so. Which rows `findInConversation` matches is the repository's SQL, held
 * by the integration suite; the engines putting the image in front of the
 * model are their own specs.
 */
const signal = new AbortController().signal;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const context = (overrides: Partial<BotToolContext> = {}): BotToolContext => ({
  owner: emptyScope('owner-1', 'org-1'),
  organizationId: 'org-1',
  botId: 'bot-1',
  conversationId: 'conversation-1',
  turnId: 'turn-1',
  homeHostId: null,
  timeZone: 'UTC',
  permission: 'auto',
  permissions: NO_PERMISSIONS,
  budget: new BotTurnBudget(),
  approvals: { request: vi.fn() },
  seesImages: true,
  credentialScopes: null,
  ...overrides,
});

const sent = (overrides: { mimeType?: 'image/png'; sizeBytes?: number } = {}) =>
  BotAttachmentEntity.create({
    id: '7c1d2e4f-0a3b-4c5d-8e9f-1a2b3c4d5e6f',
    props: {
      organizationId: 'org-1',
      botId: 'bot-1',
      uploadedByUserId: 'owner-1',
      messageId: 'message-1',
      storageKey: 'bot-attachments/org-1/bot-1/7c1d2e4f.png',
      mimeType: overrides.mimeType ?? 'image/png',
      sizeBytes: overrides.sizeBytes ?? PNG.length,
      name: 'image.png',
    },
  });

function setup(found: BotAttachmentEntity | null, bytes: Buffer | Error = PNG) {
  const images = {
    findInConversation: vi.fn<BotAttachmentRepositoryPort['findInConversation']>(async () =>
      found ? Some(found) : None,
    ),
  };
  const files = {
    read: vi.fn<BotAttachmentFilesPort['read']>(async () => {
      if (bytes instanceof Error) throw bytes;
      return bytes;
    }),
  };
  const [tool] = new BotImageToolsFactory(
    images as unknown as BotAttachmentRepositoryPort,
    files as unknown as BotAttachmentFilesPort,
    new BotAttachmentMapper(),
  ).definitions();
  if (!tool) throw new Error('no view_image');
  return { images, files, tool };
}

const ID = '7c1d2e4f-0a3b-4c5d-8e9f-1a2b3c4d5e6f';

describe('view_image', () => {
  // The regression: a bot asked about an image sent in an earlier message
  // had no way to see it again, and asked the person to send it again.
  it('hands the model an earlier image of this conversation, by its id', async () => {
    const { tool, images, files } = setup(sent());

    const result = await tool.bind(context()).run({ image_id: ID }, { signal });

    expect(images.findInConversation).toHaveBeenCalledWith('org-1', 'bot-1', 'conversation-1', ID);
    expect(files.read).toHaveBeenCalledWith('bot-attachments/org-1/bot-1/7c1d2e4f.png');
    expect(result.isError).toBeFalsy();
    expect(result.content).toContain('"image.png"');
    expect(result.images).toEqual([{ mimeType: 'image/png', data: PNG.toString('base64') }]);
    // For the model alone: nothing the chat would store or show again.
    expect(result.data).toBeUndefined();
  });

  // The authorization: an id the conversation does not carry (another
  // conversation's or bot's, an unsent upload) is none, and storage is not read.
  it('refuses an id that is not an image of this conversation, reading nothing', async () => {
    const { tool, files } = setup(null);

    const result = await tool.bind(context()).run({ image_id: ID }, { signal });

    expect(result.isError).toBe(true);
    expect(result.content).toContain(`No image ${ID} in this chat`);
    expect(result.images).toBeUndefined();
    expect(files.read).not.toHaveBeenCalled();
  });

  it('refuses an id that is not one, before any lookup', async () => {
    const { tool, images } = setup(sent());

    const result = await tool.bind(context()).run({ image_id: 'image.png' }, { signal });

    expect(result.isError).toBe(true);
    expect(images.findInConversation).not.toHaveBeenCalled();
  });

  it('says the image is gone when its file is no longer stored', async () => {
    const { tool } = setup(sent(), new Error('NoSuchKey'));

    const result = await tool.bind(context()).run({ image_id: ID }, { signal });

    expect(result.isError).toBe(true);
    expect(result.content).toContain('"image.png" is no longer stored');
    expect(result.images).toBeUndefined();
  });

  it('refuses a stored file past the image limit rather than sending it', async () => {
    const { tool } = setup(sent(), Buffer.alloc(BOT_IMAGE_MAX_BYTES + 1));

    const result = await tool.bind(context()).run({ image_id: ID }, { signal });

    expect(result.isError).toBe(true);
    expect(result.content).toContain('"image.png" cannot be shown');
    expect(result.images).toBeUndefined();
  });

  it('refuses on a model that reads no images, reading nothing', async () => {
    const { tool, images } = setup(sent());

    const result = await tool
      .bind(context({ seesImages: false }))
      .run({ image_id: ID }, { signal });

    expect(result.isError).toBe(true);
    expect(images.findInConversation).not.toHaveBeenCalled();
  });

  it(`looks at no more than ${VIEWED_IMAGES_PER_TURN} images a turn`, async () => {
    const { tool, files } = setup(sent());
    const bound = tool.bind(context());

    for (let look = 0; look < VIEWED_IMAGES_PER_TURN; look += 1) {
      expect((await bound.run({ image_id: ID }, { signal })).isError).toBeFalsy();
    }
    const over = await bound.run({ image_id: ID }, { signal });

    expect(over.isError).toBe(true);
    expect(over.content).toContain(`${VIEWED_IMAGES_PER_TURN} earlier images`);
    expect(files.read).toHaveBeenCalledTimes(VIEWED_IMAGES_PER_TURN);
  });
});
