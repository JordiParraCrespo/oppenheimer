import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';
import type { BotImageMimeType } from '@oppenheimer/shared';
import { BOT_ATTACHMENT_FILES } from '../../bots-chat.di-tokens';
import type { BotAttachmentEntity } from '../../domain/bot-attachment.entity';
import type { BotAttachmentFilesPort } from '../../infrastructure/bot-attachment-files.port';
import { FindBotAttachmentQuery } from '../find-bot-attachment/find-bot-attachment.query';
import { ReadBotAttachmentQuery } from './read-bot-attachment.query';

export interface BotAttachmentContent {
  mimeType: BotImageMimeType;
  data: Buffer;
}

/** An image's bytes, for the chat to draw: whoever may see the image may read it. */
@QueryHandler(ReadBotAttachmentQuery)
export class ReadBotAttachmentQueryHandler
  implements IQueryHandler<ReadBotAttachmentQuery, BotAttachmentContent>
{
  constructor(
    private readonly queryBus: QueryBus,
    @Inject(BOT_ATTACHMENT_FILES) private readonly files: BotAttachmentFilesPort,
  ) {}

  async execute({
    scope,
    botId,
    attachmentId,
  }: ReadBotAttachmentQuery): Promise<BotAttachmentContent> {
    const attachment = await this.queryBus.execute<FindBotAttachmentQuery, BotAttachmentEntity>(
      new FindBotAttachmentQuery(scope, botId, attachmentId),
    );
    return { mimeType: attachment.mimeType, data: await this.files.read(attachment.storageKey) };
  }
}
