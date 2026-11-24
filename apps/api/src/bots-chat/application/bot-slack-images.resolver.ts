import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { BOT_IMAGE_MAX_BYTES, type BotAttachment } from '@oppenheimer/shared';
import { SESSION_FILE_TYPES, sniffSessionFile } from '@oppenheimer/shared/protocol';
import type { SlackImage } from '../../slack/domain/slack-inbound.policy';
import {
  FindSlackImagesQuery,
  type SlackImageFetched,
} from '../../slack/queries/find-slack-images/find-slack-images.query';
import { BOT_ATTACHMENT_FILES, BOT_ATTACHMENT_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotAttachmentRepositoryPort } from '../database/bot-attachment.repository.port';
import { BotAttachmentEntity, isBotImageMimeType } from '../domain/bot-attachment.entity';
import type { BotAttachmentFilesPort } from '../infrastructure/bot-attachment-files.port';

/** Where the images came from and who shared them: the owner, through the bot's Slack app. */
export interface BotSlackImagesSource {
  organizationId: string;
  botId: string;
  slackAccountId: string;
  ownerUserId: string;
  images: readonly SlackImage[];
}

/**
 * The images the owner shared on Slack, as a console upload's are kept:
 * fetched as the bot's app, known by their bytes (never by the type Slack
 * gave), stored as uploads of the owner's, and answered in the message's
 * order for the turn's opening to carry. One that is not an image a bot
 * reads, or did not come, is left out and counted, so the turn can say so.
 * An image stored for a turn that is then not queued (a delivery twice) is
 * an unsent upload, which the daily sweep deletes.
 */
@Injectable()
export class BotSlackImagesResolver {
  constructor(
    private readonly queries: QueryBus,
    @Inject(BOT_ATTACHMENT_REPOSITORY) private readonly attachments: BotAttachmentRepositoryPort,
    @Inject(BOT_ATTACHMENT_FILES) private readonly files: BotAttachmentFilesPort,
  ) {}

  async store(source: BotSlackImagesSource): Promise<{ stored: BotAttachment[]; unread: number }> {
    if (source.images.length === 0) return { stored: [], unread: 0 };
    const fetched = await this.queries.execute<FindSlackImagesQuery, SlackImageFetched[]>(
      new FindSlackImagesQuery({
        organizationId: source.organizationId,
        accountId: source.slackAccountId,
        botId: source.botId,
        images: source.images,
        maxBytes: BOT_IMAGE_MAX_BYTES,
      }),
    );
    const stored: BotAttachment[] = [];
    for (const image of fetched) {
      const attachment = await this.keep(source, image);
      if (attachment) stored.push(attachment.toMessageAttachment());
    }
    return { stored, unread: source.images.length - stored.length };
  }

  private async keep(
    source: BotSlackImagesSource,
    image: SlackImageFetched,
  ): Promise<BotAttachmentEntity | null> {
    const mimeType = sniffSessionFile(image.bytes);
    if (!mimeType || !isBotImageMimeType(mimeType) || image.bytes.length === 0) return null;
    const extension = SESSION_FILE_TYPES.find((type) => type.mediaType === mimeType)?.extension;
    const attachment = BotAttachmentEntity.upload(
      {
        organizationId: source.organizationId,
        botId: source.botId,
        uploadedByUserId: source.ownerUserId,
        mimeType,
        sizeBytes: image.bytes.length,
        name: image.name,
      },
      (extension ?? '.bin').slice(1),
    );
    await this.files.store(attachment.storageKey, image.bytes, mimeType);
    try {
      await this.attachments.insert(attachment);
    } catch (error) {
      await this.files.remove(attachment.storageKey).catch(() => undefined);
      throw error;
    }
    return attachment;
  }
}
