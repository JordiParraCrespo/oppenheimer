/**
 * Media a turn's opening message still has to read, read when the turn
 * starts: the reader for its kind answers the words, which replace the
 * placeholder and are kept with nothing left pending, and any images, which
 * are stored as the chat's own and carried by the message; a message with
 * nothing pending is never read. The WhatsApp voice note's and image's own
 * readers are tested here too; hearing the note is
 * `transcribe-whatsapp-voice-note.command-handler.spec.ts`, fetching the
 * image `see-whatsapp-image.command-handler.spec.ts`, and the wake that
 * queues them pending is `bot-whatsapp-wake.integration.spec.ts`.
 */
import { randomUUID } from 'node:crypto';
import type { CommandBus } from '@nestjs/cqrs';
import { describe, expect, it, vi } from 'vitest';
import { SeeWhatsappImageCommand } from '../../../whatsapp/commands/see-whatsapp-image/see-whatsapp-image.command';
import { TranscribeWhatsappVoiceNoteCommand } from '../../../whatsapp/commands/transcribe-whatsapp-voice-note/transcribe-whatsapp-voice-note.command';
import type { WhatsappImageSight } from '../../../whatsapp/domain/whatsapp-image.policy';
import type { BotAttachmentRepositoryPort } from '../../database/bot-attachment.repository.port';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import type { BotAttachmentEntity } from '../../domain/bot-attachment.entity';
import {
  WHATSAPP_IMAGE_OPENING,
  WHATSAPP_VOICE_NOTE_OPENING,
  whatsappContactTurn,
  whatsappTurn,
} from '../../domain/bot-whatsapp-turn.policy';
import type { BotAttachmentFilesPort } from '../../infrastructure/bot-attachment-files.port';
import { BotOpeningMediaResolver } from '../bot-opening-media.resolver';
import type {
  BotOpeningMediaReaderPort,
  BotOpeningMediaReading,
} from '../bot-opening-media-reader.port';
import { BotWhatsappImageResolver } from '../bot-whatsapp-image.resolver';
import { BotWhatsappVoiceNoteResolver } from '../bot-whatsapp-voice-note.resolver';

const organizationId = randomUUID();
const whatsappAccountId = randomUUID();
const messageRowId = randomUUID();

const props = () => ({
  organizationId,
  botId: randomUUID(),
  requestedByUserId: randomUUID(),
  provider: 'anthropic' as const,
  model: 'claude-model',
  effort: null,
});

function queued(text: string, voiceNote: boolean, image = false) {
  return whatsappTurn(props(), {
    conversationId: randomUUID(),
    whatsappAccountId,
    messageRowId,
    text,
    voiceNote,
    image,
  });
}

function setup(
  reading: BotOpeningMediaReading = { words: '[voice note, 0:12] Call the bank' },
  kind: BotOpeningMediaReaderPort['kind'] = 'whatsapp_voice_note',
) {
  const messages: Pick<BotMessageRepositoryPort, 'saveReading'> = {
    saveReading: vi.fn(async () => {}),
  };
  const attachments: Pick<BotAttachmentRepositoryPort, 'insert'> = {
    insert: vi.fn(async (_attachment: BotAttachmentEntity) => {}),
  };
  const files: Pick<BotAttachmentFilesPort, 'store' | 'remove'> = {
    store: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  };
  const reader: BotOpeningMediaReaderPort = { kind, read: vi.fn(async () => reading) };
  const resolver = new BotOpeningMediaResolver(
    messages as BotMessageRepositoryPort,
    attachments as BotAttachmentRepositoryPort,
    files as BotAttachmentFilesPort,
    [reader],
  );
  return { resolver, messages, attachments, files, reader };
}

describe('BotOpeningMediaResolver', () => {
  // What breaks this: the bot asked "[voice note]" instead of what the owner said,
  // or the words lost from the chat and every later turn's history.
  it('reads the pending media with its kind’s reader and keeps the words, with nothing left pending', async () => {
    const { turn, opening } = queued('', true);
    const { resolver, messages, reader } = setup();
    expect(opening.content).toBe(WHATSAPP_VOICE_NOTE_OPENING);

    await resolver.read(turn, opening);

    expect(reader.read).toHaveBeenCalledWith(turn, opening);
    expect(opening.content).toBe('[voice note, 0:12] Call the bank');
    expect(opening.pendingMedia).toBeNull();
    expect(opening.attachments).toEqual([]);
    expect(messages.saveReading).toHaveBeenCalledWith(opening);
  });

  // What breaks this: a WhatsApp image the bot cannot see because it never
  // became one of the message's images, or one stored as a person's upload
  // (which the send window and the uploader's rule would refuse to claim).
  it('stores the images a reader answers as the chat’s own and has the message carry them', async () => {
    const data = Buffer.from('jpeg bytes');
    const { turn, opening } = queued(WHATSAPP_IMAGE_OPENING, false, true);
    const { resolver, messages, attachments, files } = setup(
      { words: '', images: [{ data, mimeType: 'image/jpeg', name: 'whatsapp-image.jpg' }] },
      'whatsapp_image',
    );
    expect(opening.pendingMedia).toEqual({ kind: 'whatsapp_image' });

    await resolver.read(turn, opening);

    const [stored] = vi.mocked(attachments.insert).mock.calls[0] as [BotAttachmentEntity];
    expect(stored).toMatchObject({
      uploadedByUserId: null,
      messageId: null,
      mimeType: 'image/jpeg',
      sizeBytes: data.length,
      name: 'whatsapp-image.jpg',
    });
    expect(stored.storageKey).toMatch(/\.jpg$/);
    expect(files.store).toHaveBeenCalledWith(stored.storageKey, data, 'image/jpeg');
    expect(opening.content).toBe('');
    expect(opening.attachments).toEqual([stored.toMessageAttachment()]);
    expect(opening.pendingMedia).toBeNull();
    expect(messages.saveReading).toHaveBeenCalledWith(opening);
  });

  // What breaks this: the owner typing "[voice note]" and their words being replaced,
  // or a message read twice and the speech budget spent again.
  it('reads nothing on a message with nothing pending, whatever it says', async () => {
    const { resolver, messages, reader } = setup();
    const typed = queued(WHATSAPP_VOICE_NOTE_OPENING, false);

    await resolver.read(typed.turn, typed.opening);
    await resolver.read(typed.turn, null);

    expect(typed.opening.content).toBe(WHATSAPP_VOICE_NOTE_OPENING);
    expect(reader.read).not.toHaveBeenCalled();
    expect(messages.saveReading).not.toHaveBeenCalled();
  });
});

describe('BotWhatsappVoiceNoteResolver', () => {
  it('asks the whatsapp module to hear the message the turn’s key names', async () => {
    const commands = { execute: vi.fn(async () => '[voice note, 0:12] Call the bank') };
    const reader = new BotWhatsappVoiceNoteResolver(commands as unknown as CommandBus);
    const { turn } = queued('', true);

    await expect(reader.read(turn)).resolves.toEqual({ words: '[voice note, 0:12] Call the bank' });

    const [asked] = commands.execute.mock.calls[0] as unknown as [unknown];
    expect(asked).toBeInstanceOf(TranscribeWhatsappVoiceNoteCommand);
    expect(asked).toMatchObject({ organizationId, accountId: whatsappAccountId, messageRowId });
  });
});

describe('BotWhatsappImageResolver', () => {
  const seeing = (sight: WhatsappImageSight) => {
    const commands = { execute: vi.fn(async () => sight) };
    return { commands, reader: new BotWhatsappImageResolver(commands as unknown as CommandBus) };
  };

  // What breaks this: the bot answering a photo it was never shown, or the
  // owner's caption lost when the image comes with one.
  it('asks the whatsapp module for the image the turn’s key names and answers it with the caption', async () => {
    const data = Buffer.from('jpeg bytes');
    const { commands, reader } = seeing({ seen: true, data, mimeType: 'image/jpeg' });
    const { turn, opening } = queued('What plant is this?', false, true);

    await expect(reader.read(turn, opening)).resolves.toEqual({
      words: 'What plant is this?',
      images: [{ data, mimeType: 'image/jpeg', name: 'whatsapp-image.jpg' }],
    });
    const [asked] = commands.execute.mock.calls[0] as unknown as [unknown];
    expect(asked).toBeInstanceOf(SeeWhatsappImageCommand);
    expect(asked).toMatchObject({ organizationId, accountId: whatsappAccountId, messageRowId });
  });

  // What breaks this: a contact's image losing the fence that says whose words
  // these are, once the image replaces the placeholder.
  it('keeps a contact’s fenced words as they are', async () => {
    const data = Buffer.from('png bytes');
    const { reader } = seeing({ seen: true, data, mimeType: 'image/png' });
    const { turn, opening } = whatsappContactTurn(props(), {
      conversationId: randomUUID(),
      whatsappAccountId,
      messageRowId,
      chatKind: 'direct',
      chatName: 'Ana',
      senderName: 'Ana',
      sender: '+34600333444',
      text: '[image]',
      image: true,
    });
    expect(opening.pendingMedia).toEqual({ kind: 'whatsapp_image' });

    const reading = await reader.read(turn, opening);

    expect(reading.words).toBe(opening.content);
    expect(reading.images).toEqual([{ data, mimeType: 'image/png', name: 'whatsapp-image.png' }]);
  });

  // What breaks this: a turn that fails, or a bot that pretends to see, when
  // the image could not be fetched; or the caption lost with it.
  it('says why the image could not be seen, after its caption, and sends no image', async () => {
    const { turn, opening } = queued(WHATSAPP_IMAGE_OPENING, false, true);
    const offline = seeing({ seen: false, reason: 'the host is offline' }).reader;
    await expect(offline.read(turn, opening)).resolves.toEqual({
      words: '[image, could not be seen: the host is offline]',
    });

    const captioned = queued('Look', false, true);
    const gone = seeing({ seen: false, reason: 'it is no longer kept' }).reader;
    await expect(gone.read(captioned.turn, captioned.opening)).resolves.toEqual({
      words: 'Look\n\n[image, could not be seen: it is no longer kept]',
    });
  });
});
