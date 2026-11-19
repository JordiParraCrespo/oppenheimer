/**
 * The owner's WhatsApp voice note, heard when its turn starts: the turn the
 * wake queued opens with the marker, the whatsapp module is asked for the
 * note's words, and they replace the marker on the stored message. Anything
 * else is left as it is and asks nothing. Hearing the note itself is
 * `transcribe-whatsapp-voice-note.command-handler.spec.ts`; the wake that
 * queues the marker is `bot-whatsapp-wake.integration.spec.ts`.
 */
import { randomUUID } from 'node:crypto';
import type { CommandBus } from '@nestjs/cqrs';
import { describe, expect, it, vi } from 'vitest';
import { TranscribeWhatsappVoiceNoteCommand } from '../../../whatsapp/commands/transcribe-whatsapp-voice-note/transcribe-whatsapp-voice-note.command';
import type { BotMessageRepositoryPort } from '../../database/bot-message.repository.port';
import { WHATSAPP_VOICE_NOTE_OPENING, whatsappTurn } from '../../domain/bot-whatsapp-turn.policy';
import { BotWhatsappVoiceNoteResolver } from '../bot-whatsapp-voice-note.resolver';

const organizationId = randomUUID();
const whatsappAccountId = randomUUID();
const messageRowId = randomUUID();

function queued(text: string) {
  return whatsappTurn(
    {
      organizationId,
      botId: randomUUID(),
      requestedByUserId: randomUUID(),
      provider: 'anthropic',
      model: 'claude-model',
      effort: null,
    },
    { conversationId: randomUUID(), whatsappAccountId, messageRowId, text },
  );
}

function setup() {
  const messages: Pick<BotMessageRepositoryPort, 'saveContent'> = {
    saveContent: vi.fn(async () => {}),
  };
  const commands = { execute: vi.fn(async () => '[voice note, 0:12] Call the bank') };
  const resolver = new BotWhatsappVoiceNoteResolver(
    messages as BotMessageRepositoryPort,
    commands as unknown as CommandBus,
  );
  return { resolver, messages, commands };
}

describe('BotWhatsappVoiceNoteResolver', () => {
  // What breaks this: the bot asked "[voice note]" instead of what the owner said,
  // or the words lost from the chat and every later turn's history.
  it('hears the voice note the turn answers and keeps its words on the opening message', async () => {
    const { turn, opening } = queued(WHATSAPP_VOICE_NOTE_OPENING);
    const { resolver, messages, commands } = setup();

    await resolver.hear(turn, opening);

    const asked = commands.execute.mock.calls[0] as unknown[] | undefined;
    expect(asked?.[0]).toBeInstanceOf(TranscribeWhatsappVoiceNoteCommand);
    expect(asked?.[0]).toMatchObject({
      organizationId,
      accountId: whatsappAccountId,
      messageRowId,
    });
    expect(opening.content).toBe('[voice note, 0:12] Call the bank');
    expect(messages.saveContent).toHaveBeenCalledWith(opening);
  });

  // What breaks this: a typed message, or a turn already heard, spending the speech budget again.
  it('leaves a typed message, and one already heard, as they are', async () => {
    const { resolver, messages, commands } = setup();
    for (const text of ['Call the bank', '[voice note, 0:12] Call the bank']) {
      const { turn, opening } = queued(text);
      await resolver.hear(turn, opening);
      expect(opening.content).toBe(text);
    }
    await resolver.hear(queued(WHATSAPP_VOICE_NOTE_OPENING).turn, null);

    expect(commands.execute).not.toHaveBeenCalled();
    expect(messages.saveContent).not.toHaveBeenCalled();
  });

  // What breaks this: the owner typing "[voice note]" on WhatsApp and their words being rewritten.
  it('keeps a typed message that only looks like the marker, when the row is no voice note', async () => {
    const { turn, opening } = queued(WHATSAPP_VOICE_NOTE_OPENING);
    const { resolver, messages, commands } = setup();
    commands.execute.mockResolvedValueOnce(null as unknown as string);

    await resolver.hear(turn, opening);

    expect(opening.content).toBe(WHATSAPP_VOICE_NOTE_OPENING);
    expect(messages.saveContent).not.toHaveBeenCalled();
  });
});
