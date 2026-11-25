import { randomUUID } from 'node:crypto';
import type { QueryBus } from '@nestjs/cqrs';
import type { BotAttachmentRepositoryPort } from '../../database/bot-attachment.repository.port';
import { slackOpeningText, slackTurn } from '../../domain/bot-slack-turn.policy';
import type { BotAttachmentFilesPort } from '../../infrastructure/bot-attachment-files.port';
import { BotSlackImagesResolver } from '../bot-slack-images.resolver';

/**
 * The images an owner shares on Slack reach the bot as a console upload's
 * do: judged by their bytes, kept as the owner's, in order; and what the bot
 * cannot see is said in the words it reads. A regression here lets a file
 * that only claims to be an image into the model, or answers a screenshot
 * as if nothing had been shared.
 */

/** The first bytes of a PNG: what makes a body an image, whatever Slack calls it. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const source = {
  organizationId: randomUUID(),
  botId: randomUUID(),
  slackAccountId: randomUUID(),
  ownerUserId: randomUUID(),
  images: [
    { id: 'F1', name: 'shot.png', url: 'https://files.slack.com/a.png' },
    { id: 'F2', name: 'fake.png', url: 'https://files.slack.com/b.png' },
    { id: 'F3', name: 'gone.png', url: 'https://files.slack.com/c.png' },
  ],
};

describe('BotSlackImagesResolver', () => {
  it('keeps the images that are images as the owner’s uploads, and counts the rest unread', async () => {
    const queries = {
      execute: vi.fn(async () => [
        { name: 'shot.png', bytes: PNG },
        { name: 'fake.png', bytes: Buffer.from('<html>sign in</html>') },
      ]),
    };
    const inserted: unknown[] = [];
    const attachments = { insert: vi.fn(async (row) => void inserted.push(row)) };
    const files = { store: vi.fn(async () => {}), remove: vi.fn(async () => {}) };
    const resolver = new BotSlackImagesResolver(
      queries as unknown as QueryBus,
      attachments as unknown as BotAttachmentRepositoryPort,
      files as unknown as BotAttachmentFilesPort,
    );

    const { stored, unread } = await resolver.store(source);

    expect(stored).toEqual([
      { id: expect.any(String), mimeType: 'image/png', sizeBytes: PNG.length, name: 'shot.png' },
    ]);
    expect(unread).toBe(2);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ uploadedByUserId: source.ownerUserId, messageId: null });
    expect(files.store).toHaveBeenCalledWith(
      expect.stringContaining(source.botId),
      PNG,
      'image/png',
    );
  });

  it('fetches nothing for a message that shared no image', async () => {
    const queries = { execute: vi.fn() };
    const resolver = new BotSlackImagesResolver(
      queries as unknown as QueryBus,
      {} as BotAttachmentRepositoryPort,
      {} as BotAttachmentFilesPort,
    );
    await expect(resolver.store({ ...source, images: [] })).resolves.toEqual({
      stored: [],
      unread: 0,
    });
    expect(queries.execute).not.toHaveBeenCalled();
  });
});

describe('slackOpeningText', () => {
  // What breaks this: the bot answers a screenshot it cannot see as if none was shared.
  it('tells the turn what it cannot see, and why, and nothing when it sees everything', () => {
    expect(slackOpeningText('what is wrong here?', 0, 'not_read')).toBe('what is wrong here?');
    expect(slackOpeningText('what is wrong here?', 2, 'model_reads_no_images')).toMatch(
      /^what is wrong here\?\n\n\[Oppenheimer: the owner shared 2 files .*your model reads no images\.\]$/,
    );
    expect(slackOpeningText('', 1, 'not_read')).toMatch(/^\[Oppenheimer: the owner shared a file /);
  });
});

describe('slackTurn', () => {
  // What breaks this: images written mid-turn are folded into the running turn
  // as a steer, which carries words only, and are never seen.
  it('queues a message with images as a turn of its own, words alone as a steer', () => {
    const props = {
      organizationId: source.organizationId,
      botId: source.botId,
      requestedByUserId: source.ownerUserId,
      provider: 'anthropic' as const,
      model: 'claude-opus',
      effort: null,
    };
    const message = {
      conversationId: randomUUID(),
      slackAccountId: source.slackAccountId,
      channel: 'C1',
      ts: '1700000000.000100',
      text: 'and this one?',
    };
    const image = {
      id: randomUUID(),
      mimeType: 'image/png' as const,
      sizeBytes: 10,
      name: 'a.png',
    };
    const withImage = slackTurn(props, { ...message, attachments: [image] });
    expect(withImage.opening.attachments).toEqual([image]);
    expect(withImage.turn.steer).toBe(false);
    expect(slackTurn(props, message).turn.steer).toBe(true);
  });
});
