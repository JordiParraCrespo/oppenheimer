/**
 * Media a turn's opening message still has to read, read when the turn
 * starts: the reader for its kind answers the words, which replace the
 * placeholder and are kept with nothing left pending; a message with nothing
 * pending is never read. The WhatsApp voice note's own reader is tested here
 * too; hearing the note is `transcribe-whatsapp-voice-note.command-handler.spec.ts`,
 * and the wake that queues it pending is `bot-whatsapp-wake.integration.spec.ts`.
 */
import { randomUUID } from 'node:crypto';
import type { CommandBus } from '@nestjs/cqrs';
import { describe, expect, it, vi } from 'vitest';
import { TranscribeWhatsappVoiceNoteCommand } from '../../../whatsapp/commands/transcribe-whatsapp-voice-note/transcribe-whatsapp-voice-note.command';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import { WHATSAPP_VOICE_NOTE_OPENING, whatsappTurn } from '../../domain/bot-whatsapp-turn.policy';
import { BotOpeningMediaResolver } from '../bot-opening-media.resolver';
import type { BotOpeningMediaReaderPort } from '../bot-opening-media-reader.port';
import { BotWhatsappVoiceNoteResolver } from '../bot-whatsapp-voice-note.resolver';

const organizationId = randomUUID();
const whatsappAccountId = randomUUID();
const messageRowId = randomUUID();

function queued(text: string, voiceNote: boolean) {
  return whatsappTurn(
    {
      organizationId,
      botId: randomUUID(),
      requestedByUserId: randomUUID(),
      provider: 'anthropic',
      model: 'claude-model',
      effort: null,
    },
    { conversationId: randomUUID(), whatsappAccountId, messageRowId, text, voiceNote },
  );
}

function setup() {
  const messages: Pick<BotMessageRepositoryPort, 'saveContent'> = {
    saveContent: vi.fn(async () => {}),
  };
  const reader: BotOpeningMediaReaderPort = {
    kind: 'whatsapp_voice_note',
    read: vi.fn(async () => '[voice note, 0:12] Call the bank'),
  };
  const resolver = new BotOpeningMediaResolver(messages as BotMessageRepositoryPort, [reader]);
  return { resolver, messages, reader };
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
    expect(messages.saveContent).toHaveBeenCalledWith(opening);
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
    expect(messages.saveContent).not.toHaveBeenCalled();
  });
});

describe('BotWhatsappVoiceNoteResolver', () => {
  it('asks the whatsapp module to hear the message the turn’s key names', async () => {
    const commands = { execute: vi.fn(async () => '[voice note, 0:12] Call the bank') };
    const reader = new BotWhatsappVoiceNoteResolver(commands as unknown as CommandBus);
    const { turn } = queued('', true);

    await expect(reader.read(turn)).resolves.toBe('[voice note, 0:12] Call the bank');

    const [asked] = commands.execute.mock.calls[0] as unknown as [unknown];
    expect(asked).toBeInstanceOf(TranscribeWhatsappVoiceNoteCommand);
    expect(asked).toMatchObject({ organizationId, accountId: whatsappAccountId, messageRowId });
  });
});
