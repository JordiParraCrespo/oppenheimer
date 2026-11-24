import type { BotImageMimeType } from '@oppenheimer/shared';
import type { BotMessageEntity, BotPendingMediaKind } from '../domain/bot-message.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';

/** An image a reader found the media to be, for the chat to keep and the turn to see. */
export interface BotOpeningImage {
  data: Buffer;
  mimeType: BotImageMimeType;
  /** The name the chat shows for it. */
  name: string;
}

/** What reading a message's pending media came to: its words, and any images it is. */
export interface BotOpeningMediaReading {
  words: string;
  images?: readonly BotOpeningImage[];
}

/**
 * Reads one kind of media a turn's opening message still carries, when the
 * turn starts: what it says, as the words the turn is asked, and the images
 * it is, which the turn is sent. A new kind is a class implementing this, its
 * id in `BOT_PENDING_MEDIA_KINDS`, and its place in
 * `BOT_OPENING_MEDIA_READERS` (`bots-chat.module.ts`); the turn's path needs
 * nothing else. `read` answers words for every way it can fail too (why it
 * could not be read), so the turn runs all the same.
 */
export interface BotOpeningMediaReaderPort {
  readonly kind: BotPendingMediaKind;
  read(turn: BotTurnEntity, opening: BotMessageEntity): Promise<BotOpeningMediaReading>;
}
