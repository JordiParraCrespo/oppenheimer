import { Inject, Injectable } from '@nestjs/common';
import {
  BOT_ATTACHMENT_FILES,
  BOT_ATTACHMENT_REPOSITORY,
  BOT_MESSAGE_REPOSITORY,
  BOT_OPENING_MEDIA_READERS,
} from '../bots-chat.di-tokens';
import type { BotAttachmentRepositoryPort } from '../database/bot-attachment.repository.port';
import type { BotMessageRepositoryPort } from '../database/bot-message.repository.port';
import { BotAttachmentEntity } from '../domain/bot-attachment.entity';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import type { BotAttachmentFilesPort } from '../infrastructure/bot-attachment-files.port';
import type { BotOpeningImage, BotOpeningMediaReaderPort } from './bot-opening-media-reader.port';

/**
 * Reads the media a turn's opening message still carries, before the turn is
 * asked it: the reader for its kind answers the words, which replace the
 * message's placeholder and are kept, so the chat and every later turn read
 * them too and the media is never read twice. The images a reader answers
 * are stored as the chat's own, as a bot's shown image is (no person
 * uploaded them), and the message carries them from then on: the turn is
 * sent them like any image of yours. A message with nothing pending, or of a
 * kind no reader takes, is left as it is.
 */
@Injectable()
export class BotOpeningMediaResolver {
  constructor(
    @Inject(BOT_MESSAGE_REPOSITORY) private readonly messages: BotMessageRepositoryPort,
    @Inject(BOT_ATTACHMENT_REPOSITORY) private readonly attachments: BotAttachmentRepositoryPort,
    @Inject(BOT_ATTACHMENT_FILES) private readonly files: BotAttachmentFilesPort,
    @Inject(BOT_OPENING_MEDIA_READERS)
    private readonly readers: readonly BotOpeningMediaReaderPort[],
  ) {}

  async read(turn: BotTurnEntity, opening: BotMessageEntity | null): Promise<void> {
    const pending = opening?.pendingMedia;
    if (!opening || !pending) return;
    const reader = this.readers.find((candidate) => candidate.kind === pending.kind);
    if (!reader) return;
    const reading = await reader.read(turn, opening);
    const images = await Promise.all(
      (reading.images ?? []).map((image) => this.store(opening, image)),
    );
    opening.read(
      reading.words,
      images.map((image) => image.toMessageAttachment()),
    );
    await this.messages.saveReading(opening);
  }

  /**
   * One image, stored unclaimed: the message's save claims it, and one a
   * failed save leaves behind is swept with the other unclaimed images.
   */
  private async store(opening: BotMessageEntity, image: BotOpeningImage) {
    const attachment = BotAttachmentEntity.upload(
      {
        organizationId: opening.organizationId,
        botId: opening.botId,
        uploadedByUserId: null,
        mimeType: image.mimeType,
        sizeBytes: image.data.length,
        name: image.name,
      },
      image.name.split('.').pop() ?? 'bin',
    );
    await this.files.store(attachment.storageKey, image.data, image.mimeType);
    try {
      await this.attachments.insert(attachment);
    } catch (error) {
      await this.files.remove(attachment.storageKey).catch(() => undefined);
      throw error;
    }
    return attachment;
  }
}
