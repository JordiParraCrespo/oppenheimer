import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { TranscribeWhatsappVoiceNoteCommand } from '../../whatsapp/commands/transcribe-whatsapp-voice-note/transcribe-whatsapp-voice-note.command';
import { promptText } from '../domain/bot-prompt-text.policy';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { whatsappMessageOf } from '../domain/bot-whatsapp-turn.policy';
import type {
  BotOpeningMediaReaderPort,
  BotOpeningMediaReading,
} from './bot-opening-media-reader.port';

/**
 * The owner's WhatsApp voice note, read when its turn starts: the whatsapp
 * module fetches it from the host and transcribes it, and answers its words or
 * why they could not be heard. The note is the message the turn's key names.
 */
@Injectable()
export class BotWhatsappVoiceNoteResolver implements BotOpeningMediaReaderPort {
  readonly kind = 'whatsapp_voice_note';

  constructor(private readonly commands: CommandBus) {}

  async read(turn: BotTurnEntity): Promise<BotOpeningMediaReading> {
    const source = whatsappMessageOf(turn.sourceKey);
    if (!source) return { words: promptText('turn/voice-note') };
    const words = await this.commands.execute<TranscribeWhatsappVoiceNoteCommand, string>(
      new TranscribeWhatsappVoiceNoteCommand({
        organizationId: turn.organizationId,
        accountId: source.whatsappAccountId,
        messageRowId: source.messageRowId,
      }),
    );
    return { words };
  }
}
