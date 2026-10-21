import { randomUUID } from 'node:crypto';
import {
  attachmentName,
  BOT_ATTACHMENT_SEND_WINDOW_MS,
  BOT_ATTACHMENT_UNSENT_TTL_MS,
  BotAttachmentEntity,
} from '../domain/bot-attachment.entity';
import { BotMessageEntity } from '../domain/bot-message.entity';

/**
 * A chat image and the message that carries it: who may send an upload, what
 * a message keeps of it, and which messages may carry images at all.
 */
const organizationId = randomUUID();
const botId = randomUUID();
const userId = randomUUID();

function upload(props: Partial<Parameters<typeof BotAttachmentEntity.upload>[0]> = {}) {
  return BotAttachmentEntity.upload(
    {
      organizationId,
      botId,
      uploadedByUserId: userId,
      mimeType: 'image/webp',
      sizeBytes: 42,
      name: 'diagram.webp',
      ...props,
    },
    'webp',
  );
}

function message(props: Partial<Parameters<typeof BotMessageEntity.createNew>[0]>) {
  return BotMessageEntity.createNew({
    organizationId,
    botId,
    turnId: randomUUID(),
    role: 'user',
    content: '',
    steps: [],
    position: 0,
    ...props,
  });
}

describe('BotAttachmentEntity', () => {
  it('closes the send window an hour before the sweep may delete an image', () => {
    expect(BOT_ATTACHMENT_UNSENT_TTL_MS - BOT_ATTACHMENT_SEND_WINDOW_MS).toBe(60 * 60 * 1000);
  });

  it('refuses a type a bot does not read and an image past the limit', () => {
    expect(() => upload({ mimeType: 'image/svg+xml' as never })).toThrow();
    expect(() => upload({ sizeBytes: 5 * 1024 * 1024 + 1 })).toThrow();
    expect(() => upload({ sizeBytes: 0 })).toThrow();
  });

  it('keeps a name’s last path segment, without control characters', () => {
    expect(attachmentName('/home/ada/shots/screen\u0007.png')).toBe('screen.png');
    expect(attachmentName('C:\\Users\\ada\\a.jpg')).toBe('a.jpg');
    expect(attachmentName('x'.repeat(400))).toHaveLength(255);
  });
});

describe('BotMessageEntity with images', () => {
  it('lets a message of yours be images alone, with no words', () => {
    const image = upload().toMessageAttachment();
    expect(message({ attachments: [image] }).attachments).toEqual([image]);
  });

  it('still refuses a message of yours with neither words nor images', () => {
    expect(() => message({})).toThrow('A message says something');
  });

  it('refuses images on the bot’s side, and more than four on one message', () => {
    const image = upload().toMessageAttachment();
    expect(() => message({ role: 'assistant', content: 'Hi', attachments: [image] })).toThrow();
    expect(() => message({ attachments: [1, 2, 3, 4, 5].map(() => image) })).toThrow();
  });
});
