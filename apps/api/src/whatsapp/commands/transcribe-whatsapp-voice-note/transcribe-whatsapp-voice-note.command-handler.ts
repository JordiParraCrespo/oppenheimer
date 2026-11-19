import { Inject, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { VoiceTranscriptionDto } from '@oppenheimer/shared';
import { TranscribeVoiceCommand } from '../../../voice/commands/transcribe-voice/transcribe-voice.command';
import type { WhatsappDevicePort } from '../../application/whatsapp-device.port';
import type { WhatsappAccountRepositoryPort } from '../../database/whatsapp-account.repository.port';
import type { WhatsappMessageRepositoryPort } from '../../database/whatsapp-message.repository.port';
import {
  isWhatsappVoiceNote,
  type WhatsappVoiceNoteHearing,
  whatsappVoiceNoteMissReason,
  whatsappVoiceNoteText,
} from '../../domain/whatsapp-voice-note.policy';
import type { VoiceNoteDecoderPort } from '../../infrastructure/voice-note-decoder.port';
import {
  VOICE_NOTE_DECODER,
  WHATSAPP_ACCOUNT_REPOSITORY,
  WHATSAPP_DEVICE,
  WHATSAPP_MESSAGE_REPOSITORY,
} from '../../whatsapp.di-tokens';
import { TranscribeWhatsappVoiceNoteCommand } from './transcribe-whatsapp-voice-note.command';

/**
 * Hears a voice note: the host hands its audio over (`whatsapp.media.get`),
 * it is decoded to WAV here, and the workspace's dictation hears it
 * (`TranscribeVoiceCommand`: its ChatGPT sign-in, else the deployment's speech
 * server, then the polish). The transcript is kept on the row, so a note is
 * heard once however often it is asked about; the audio is kept nowhere.
 * Answers the note as the bot reads it (`whatsappVoiceNoteText`). Every way
 * hearing it can fail is an answer, so the turn runs all the same and the bot
 * can say it could not hear it; what is not a way it fails (a bug) throws, and
 * fails the turn.
 */
@CommandHandler(TranscribeWhatsappVoiceNoteCommand)
export class TranscribeWhatsappVoiceNoteCommandHandler
  implements ICommandHandler<TranscribeWhatsappVoiceNoteCommand, string>
{
  private readonly logger = new Logger(TranscribeWhatsappVoiceNoteCommandHandler.name);

  constructor(
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY)
    private readonly accounts: WhatsappAccountRepositoryPort,
    @Inject(WHATSAPP_MESSAGE_REPOSITORY)
    private readonly messages: WhatsappMessageRepositoryPort,
    @Inject(WHATSAPP_DEVICE) private readonly device: WhatsappDevicePort,
    @Inject(VOICE_NOTE_DECODER) private readonly decoder: VoiceNoteDecoderPort,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: TranscribeWhatsappVoiceNoteCommand): Promise<string> {
    const found = await this.accounts.findByIdForSystem(command.organizationId, command.accountId);
    if (found.isNone()) {
      return whatsappVoiceNoteText(null, {
        heard: false,
        reason: 'the WhatsApp number was removed',
      });
    }
    const account = found.unwrap();
    const ref = { organizationId: account.organizationId, accountId: account.id };
    const message = await this.messages.findById(ref, command.messageRowId);
    if (!message || !isWhatsappVoiceNote(message)) {
      return whatsappVoiceNoteText(null, { heard: false, reason: 'it is no longer kept' });
    }
    const seconds = message.voiceSeconds;
    if (message.transcript !== null) {
      return whatsappVoiceNoteText(seconds, { heard: true, transcript: message.transcript });
    }
    const note = await this.device.voiceNote(account.hostId, message.chatId, message.externalId);
    if (note.kind !== 'fetched') {
      return whatsappVoiceNoteText(seconds, {
        heard: false,
        reason: whatsappVoiceNoteMissReason(note),
      });
    }
    const wav = await this.decoder.toWav(note.data);
    if (!wav) {
      const reason = `it is not audio that can be decoded (${note.mimetype})`;
      return whatsappVoiceNoteText(seconds, { heard: false, reason });
    }
    const heard = await this.hear(account.organizationId, wav);
    if (heard.heard) await this.messages.saveTranscript(ref, message.id, heard.transcript);
    return whatsappVoiceNoteText(seconds, heard);
  }

  private async hear(organizationId: string, audio: Buffer): Promise<WhatsappVoiceNoteHearing> {
    try {
      const { text } = await this.commandBus.execute<TranscribeVoiceCommand, VoiceTranscriptionDto>(
        new TranscribeVoiceCommand({
          organizationId,
          audio,
          vocabulary: undefined,
          language: undefined,
        }),
      );
      return { heard: true, transcript: text.trim() };
    } catch (error) {
      if (error instanceof AppError) {
        this.logger.warn({ message: 'A WhatsApp voice note could not be heard', code: error.code });
        return { heard: false, reason: `${error.message.toLowerCase()} (${error.code})` };
      }
      this.logger.error(
        { message: 'Hearing a WhatsApp voice note failed', organizationId },
        error instanceof Error ? error.stack : String(error),
      );
      return { heard: false, reason: 'the speech-to-text step failed' };
    }
  }
}
