import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { BOT_IMAGE_MAX_BYTES, BOT_IMAGE_MIME_TYPES, botTakesImages } from '@oppenheimer/shared';
import { SESSION_FILE_TYPES, sniffSessionFile } from '@oppenheimer/shared/protocol';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BOT_ATTACHMENT_FILES, BOT_ATTACHMENT_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotAttachmentRepositoryPort } from '../../database/bot-attachment.repository.port';
import { BotAttachmentEntity, isBotImageMimeType } from '../../domain/bot-attachment.entity';
import type { BotAttachmentFilesPort } from '../../infrastructure/bot-attachment-files.port';
import { UploadBotAttachmentCommand } from './upload-bot-attachment.command';

/**
 * An image picked in a bot's composer (`25-bots.md` §3.1), stored before the
 * message is sent so the composer can show it, and refuse it, while the
 * person is still writing. It is known by its bytes, never by the type the
 * browser gave it, through the table a session's files are judged by. A bot
 * whose model reads no images is refused here, before anything is stored.
 * An upload never sent is swept after a day.
 */
@CommandHandler(UploadBotAttachmentCommand)
export class UploadBotAttachmentCommandHandler
  implements ICommandHandler<UploadBotAttachmentCommand, string>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_ATTACHMENT_REPOSITORY) private readonly attachments: BotAttachmentRepositoryPort,
    @Inject(BOT_ATTACHMENT_FILES) private readonly files: BotAttachmentFilesPort,
  ) {}

  async execute({ scope, botId, file, name }: UploadBotAttachmentCommand): Promise<string> {
    const bot = await this.lookup.bot(scope, botId);
    if (!botTakesImages(bot.provider)) {
      throw new AppError(BotErrors.MODEL_TAKES_NO_IMAGES, {
        detail: `A bot on ${bot.provider} reads no images`,
        extensions: { provider: bot.provider },
      });
    }
    if (file.length > BOT_IMAGE_MAX_BYTES) {
      throw new AppError(BotErrors.ATTACHMENT_TOO_LARGE, {
        detail: `That image is ${file.length} bytes; the limit is ${BOT_IMAGE_MAX_BYTES}.`,
        extensions: { maxBytes: BOT_IMAGE_MAX_BYTES },
      });
    }
    const mimeType = sniffSessionFile(file);
    if (!mimeType || !isBotImageMimeType(mimeType)) {
      throw new AppError(BotErrors.ATTACHMENT_TYPE_UNSUPPORTED, {
        detail: `Use one of: ${BOT_IMAGE_MIME_TYPES.join(', ')}.`,
        extensions: { acceptedMimeTypes: [...BOT_IMAGE_MIME_TYPES] },
      });
    }
    const extension = SESSION_FILE_TYPES.find((type) => type.mediaType === mimeType)?.extension;
    const attachment = BotAttachmentEntity.upload(
      {
        organizationId: bot.organizationId,
        botId: bot.id,
        uploadedByUserId: scope.userId,
        mimeType,
        sizeBytes: file.length,
        name,
      },
      (extension ?? '.bin').slice(1),
    );
    await this.files.store(attachment.storageKey, file, mimeType);
    try {
      await this.attachments.insert(attachment);
    } catch (error) {
      await this.files.remove(attachment.storageKey).catch(() => undefined);
      throw error;
    }
    return attachment.id;
  }
}
