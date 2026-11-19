import { Inject, Injectable } from '@nestjs/common';
import { BOT_MESSAGE_REPOSITORY, BOT_OPENING_MEDIA_READERS } from '../bots-chat.di-tokens';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import type { BotOpeningMediaReaderPort } from './bot-opening-media-reader.port';

/**
 * Reads the media a turn's opening message still carries, before the turn is
 * asked it: the reader for its kind answers the words, which replace the
 * message's placeholder and are kept, so the chat and every later turn read
 * them too and the media is never read twice. A message with nothing pending,
 * or of a kind no reader takes, is left as it is.
 */
@Injectable()
export class BotOpeningMediaResolver {
  constructor(
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_OPENING_MEDIA_READERS)
    private readonly readers: readonly BotOpeningMediaReaderPort[],
  ) {}

  async read(turn: BotTurnEntity, opening: BotMessageEntity | null): Promise<void> {
    const pending = opening?.pendingMedia;
    if (!opening || !pending) return;
    const reader = this.readers.find((candidate) => candidate.kind === pending.kind);
    if (!reader) return;
    opening.read(await reader.read(turn, opening));
    await this.messages.saveContent(opening);
  }
}
