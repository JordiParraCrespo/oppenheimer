import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import { type BotAttachment, botTakesImages } from '@oppenheimer/shared';
import type { BotEntity } from '../../bots/domain/bot.entity';
import { BotErrors } from '../../bots/domain/bots.errors';
import { BOT_ATTACHMENT_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotAttachmentRepositoryPort } from '../database/bot-attachment.repository.port';

/**
 * The images a message to a bot may carry (`25-bots.md` §3.1), in the order
 * they were attached: each the sender's own upload to this bot, none sent
 * before, and only to a bot whose model reads images. Whether another send
 * claims one first is the enqueue's to decide, in its transaction.
 */
@Injectable()
export class BotMessageAttachmentsResolver {
  constructor(
    @Inject(BOT_ATTACHMENT_REPOSITORY) private readonly attachments: BotAttachmentRepositoryPort,
  ) {}

  async sendable(userId: string, bot: BotEntity, ids: readonly string[]): Promise<BotAttachment[]> {
    if (ids.length === 0) return [];
    if (!botTakesImages(bot.provider)) {
      throw new AppError(BotErrors.MODEL_TAKES_NO_IMAGES, {
        detail: `A bot on ${bot.provider} reads no images`,
        extensions: { provider: bot.provider },
      });
    }
    const found = await this.attachments.findManyForBot(bot.organizationId, bot.id, ids);
    return ids.map((id) => {
      const attachment = found.find((candidate) => candidate.id === id);
      if (attachment?.messageId) {
        throw new AppError(BotErrors.ATTACHMENT_SENT, { extensions: { attachmentId: id } });
      }
      if (!attachment?.sendableBy(userId, bot.id)) {
        throw new AppError(BotErrors.ATTACHMENT_NOT_FOUND, { extensions: { attachmentId: id } });
      }
      return attachment.toMessageAttachment();
    });
  }
}
