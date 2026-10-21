import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { BotLookupPort } from '../../../bots/application/bot-lookup.port';
import { BOT_LOOKUP } from '../../../bots/bots.di-tokens';
import { BotErrors } from '../../../bots/domain/bots.errors';
import { BOT_ATTACHMENT_REPOSITORY } from '../../bots-chat.di-tokens';
import type { BotAttachmentRepositoryPort } from '../../database/bot-attachment.repository.port';
import type { BotAttachmentEntity } from '../../domain/bot-attachment.entity';
import { FindBotAttachmentQuery } from './find-bot-attachment.query';

/**
 * One image of a bot in the caller's workspace: one a message carries, or
 * the caller's own upload not sent yet. Anyone else's unsent upload is one
 * that does not exist (`BOTS_026`).
 */
@QueryHandler(FindBotAttachmentQuery)
export class FindBotAttachmentQueryHandler
  implements IQueryHandler<FindBotAttachmentQuery, BotAttachmentEntity>
{
  constructor(
    @Inject(BOT_LOOKUP) private readonly lookup: BotLookupPort,
    @Inject(BOT_ATTACHMENT_REPOSITORY) private readonly attachments: BotAttachmentRepositoryPort,
  ) {}

  async execute({
    scope,
    botId,
    attachmentId,
  }: FindBotAttachmentQuery): Promise<BotAttachmentEntity> {
    const bot = await this.lookup.bot(scope, botId);
    const found = await this.attachments.findForBot(bot.organizationId, bot.id, attachmentId);
    if (found.isNone()) throw new AppError(BotErrors.ATTACHMENT_NOT_FOUND);
    const attachment = found.unwrap();
    if (attachment.messageId === null && attachment.uploadedByUserId !== scope.userId) {
      throw new AppError(BotErrors.ATTACHMENT_NOT_FOUND);
    }
    return attachment;
  }
}
