import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { TranscribeWhatsappVoiceNoteCommand } from '../../whatsapp/commands/transcribe-whatsapp-voice-note/transcribe-whatsapp-voice-note.command';
import { BOT_MESSAGE_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { WHATSAPP_VOICE_NOTE_OPENING, whatsappMessageOf } from '../domain/bot-whatsapp-turn.policy';

/**
 * Hears the owner's WhatsApp voice note when its turn starts, on the turn's
 * worker: the whatsapp module fetches it from the host and transcribes it,
 * and its words (or why it could not be heard) replace the turn's opening
 * marker, kept so the chat and every later turn read them too. Anything else
 * (a text the owner typed that only looks like the marker included) is left
 * as it is.
 */
@Injectable()
export class BotWhatsappVoiceNoteResolver {
  constructor(
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    private readonly commands: CommandBus,
  ) {}

  async hear(turn: BotTurnEntity, opening: BotMessageEntity | null): Promise<void> {
    if (turn.origin !== 'whatsapp' || opening?.role !== 'user') return;
    if (opening.content !== WHATSAPP_VOICE_NOTE_OPENING) return;
    const source = whatsappMessageOf(turn.sourceKey);
    if (!source) return;
    const words = await this.commands.execute<TranscribeWhatsappVoiceNoteCommand, string | null>(
      new TranscribeWhatsappVoiceNoteCommand({
        organizationId: turn.organizationId,
        accountId: source.whatsappAccountId,
        messageRowId: source.messageRowId,
      }),
    );
    if (words === null) return;
    opening.heard(words);
    await this.messages.saveContent(opening);
  }
}
