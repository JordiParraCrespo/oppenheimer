/**
 * Hearing the owner's voice note: the host hands the audio over, it is decoded
 * to the WAV the voice module takes (the real decoder, over a real Ogg/Opus
 * note), heard once and kept, and every way it fails is a line the bot can
 * pass on rather than a throw. The wake that dispatches it is
 * `bot-whatsapp-wake.integration.spec.ts`.
 */
import 'reflect-metadata';
import type { CommandBus } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import { TranscribeVoiceCommand } from '../../../../voice/commands/transcribe-voice/transcribe-voice.command';
import { VoiceErrors } from '../../../../voice/domain/voice.errors';
import { isPcmWav } from '../../../../voice/domain/voice-audio.policy';
import type { WhatsappDevicePort } from '../../../application/whatsapp-device.port';
import type { WhatsappAccountRepositoryPort } from '../../../database/whatsapp-account.repository.port';
import type { WhatsappMessageRepositoryPort } from '../../../database/whatsapp-message.repository.port';
import { WhatsappAccountEntity } from '../../../domain/whatsapp-account.entity';
import type { WhatsappMessage } from '../../../domain/whatsapp-message.types';
import { OggOpusVoiceNoteDecoderAdapter } from '../../../infrastructure/ogg-opus-voice-note-decoder.adapter';
import { TranscribeWhatsappVoiceNoteCommand } from '../transcribe-whatsapp-voice-note.command';
import { TranscribeWhatsappVoiceNoteCommandHandler } from '../transcribe-whatsapp-voice-note.command-handler';

const ORG = '0b3e2a1c-1111-4c5d-8e6f-70819203b4c5';
/** One second of a 440 Hz tone as WhatsApp records a voice note: Ogg/Opus, mono, 12 kbit/s (made with ffmpeg). */
const NOTE = Buffer.from(
  [
    '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',
  ].join(''),
  'base64',
);

const account = WhatsappAccountEntity.link({
  organizationId: ORG,
  userId: '0b3e2a1c-2222-4c5d-8e6f-70819203b4c5',
  hostId: '0b3e2a1c-3333-4c5d-8e6f-70819203b4c5',
  label: 'Spare',
});

function voiceNote(over: Partial<WhatsappMessage> = {}): WhatsappMessage {
  return {
    id: 'row-1',
    accountId: account.id,
    organizationId: ORG,
    externalId: '3EB0V',
    chatId: '34600999888@s.whatsapp.net',
    chatKind: 'direct',
    chatName: null,
    senderId: '34600999888@s.whatsapp.net',
    senderName: null,
    fromMe: false,
    text: '',
    media: 'audio',
    quotedId: null,
    sentAt: new Date('2026-11-18T12:00:00Z'),
    sentByBotId: null,
    voiceSeconds: 12,
    transcript: null,
    ...over,
  };
}

function setup(opts: {
  message?: WhatsappMessage | null;
  device?: Awaited<ReturnType<WhatsappDevicePort['voiceNote']>>;
  heard?: () => Promise<unknown>;
}) {
  const accounts: Pick<WhatsappAccountRepositoryPort, 'findByIdForSystem'> = {
    findByIdForSystem: async (organizationId, id) =>
      organizationId === ORG && id === account.id ? Some(account) : None,
  };
  const messages: Pick<WhatsappMessageRepositoryPort, 'findById' | 'saveTranscript'> = {
    findById: vi.fn(async () => (opts.message === undefined ? voiceNote() : opts.message)),
    saveTranscript: vi.fn(async () => {}),
  };
  const device: Pick<WhatsappDevicePort, 'voiceNote'> = {
    voiceNote: vi.fn(
      async () =>
        opts.device ?? { kind: 'fetched' as const, data: NOTE, mimetype: 'audio/ogg; codecs=opus' },
    ),
  };
  const commandBus = {
    execute: vi.fn(
      opts.heard ??
        (async () => ({
          text: 'Call the bank tomorrow',
          raw: '',
          provider: 'speech_key',
          polished: true,
        })),
    ),
  };
  const handler = new TranscribeWhatsappVoiceNoteCommandHandler(
    accounts as WhatsappAccountRepositoryPort,
    messages as WhatsappMessageRepositoryPort,
    device as WhatsappDevicePort,
    new OggOpusVoiceNoteDecoderAdapter(),
    commandBus as unknown as CommandBus,
  );
  const run = () =>
    handler.execute(
      new TranscribeWhatsappVoiceNoteCommand({
        organizationId: ORG,
        accountId: account.id,
        messageRowId: 'row-1',
      }),
    );
  return { run, messages, device, commandBus };
}

describe('TranscribeWhatsappVoiceNoteCommandHandler', () => {
  // What breaks this: the bot reading "[audio]", or a note heard (and paid for) on every read.
  it('fetches the note from its host, hears it as 16-bit PCM WAV and keeps the transcript', async () => {
    const { run, messages, device, commandBus } = setup({});

    await expect(run()).resolves.toBe('[voice note, 0:12] Call the bank tomorrow');

    expect(device.voiceNote).toHaveBeenCalledWith(
      account.hostId,
      '34600999888@s.whatsapp.net',
      '3EB0V',
    );
    const sent = commandBus.execute.mock.calls[0]?.[0] as TranscribeVoiceCommand;
    expect(sent).toBeInstanceOf(TranscribeVoiceCommand);
    expect(sent.organizationId).toBe(ORG);
    expect(isPcmWav(sent.audio ?? Buffer.alloc(0))).toBe(true);
    // One second at 16 kHz, 16 bits: what the speech model is sent.
    expect(sent.audio?.length).toBeGreaterThan(44 + 16_000);
    expect(messages.saveTranscript).toHaveBeenCalledWith(
      { organizationId: ORG, accountId: account.id },
      'row-1',
      'Call the bank tomorrow',
    );
  });

  it('answers a note already heard from its row, without asking the host again', async () => {
    const { run, device, commandBus } = setup({ message: voiceNote({ transcript: 'Hola' }) });

    await expect(run()).resolves.toBe('[voice note, 0:12] Hola');
    expect(device.voiceNote).not.toHaveBeenCalled();
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  // What breaks this: a wake that throws and is redelivered until it is parked, leaving the owner unanswered.
  it('answers why when the host cannot hand the note over, and keeps nothing', async () => {
    const { run, messages, commandBus } = setup({ device: { kind: 'failed', code: 'WA_006' } });

    await expect(run()).resolves.toBe(
      '[voice note, 0:12, could not be transcribed: it is too long (about two minutes at most)]',
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(messages.saveTranscript).not.toHaveBeenCalled();
  });

  it('answers why when the workspace has nobody to hear it, and keeps nothing', async () => {
    const { run, messages } = setup({
      heard: async () => {
        throw new AppError(VoiceErrors.NOT_CONFIGURED);
      },
    });

    await expect(run()).resolves.toBe(
      '[voice note, 0:12, could not be transcribed: dictation is not set up for this workspace (VOICE_005)]',
    );
    expect(messages.saveTranscript).not.toHaveBeenCalled();
  });

  it('answers why when what the host handed over is not Ogg/Opus', async () => {
    const { run, commandBus } = setup({
      device: { kind: 'fetched', data: Buffer.from('ID3 not ogg'), mimetype: 'audio/mpeg' },
    });

    await expect(run()).resolves.toMatch(/could not be transcribed: .*audio\/mpeg/);
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
