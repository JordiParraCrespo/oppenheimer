import { Inject, Injectable } from '@nestjs/common';
import { type MailPlan, mailAttachmentKey } from '@oppenheimer/shared';
import type { MailLocalFiles, MailRequest } from '../../mail/domain/mail-send.policy';
import { chatImageAttachment } from '../bot-mail-tool.mapper';
import { BOT_ATTACHMENT_FILES, BOT_ATTACHMENT_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotAttachmentRepositoryPort } from '../database/bot-attachment.repository.port';
import type { BotAttachmentFilesPort } from '../infrastructure/bot-attachment-files.port';
import { type BotToolCallContext, BotToolRefusal } from './bot-tool.factory';

/**
 * The bot's own files a mail carries (`product/next-steps/mail.md` §3.4):
 * images the person sent in this chat, named by id when the message is
 * planned and read from storage only when it is written or sent. The mail
 * module never reads the bot's storage; it is handed the bytes.
 */
@Injectable()
export class BotMailChatFilesResolver {
  constructor(
    @Inject(BOT_ATTACHMENT_REPOSITORY) private readonly images: BotAttachmentRepositoryPort,
    @Inject(BOT_ATTACHMENT_FILES) private readonly files: BotAttachmentFilesPort,
  ) {}

  /** The images a call names, as the plan lists them; one the bot does not have is refused. */
  async planned(
    ids: readonly string[],
    context: BotToolCallContext,
  ): Promise<MailRequest['localFiles']> {
    if (ids.length === 0) return [];
    const found = await this.images.findManyForBot(context.organizationId, context.botId, ids);
    return ids.map((id) => {
      const image = found.find((candidate) => candidate.id === id);
      if (!image) {
        throw new BotToolRefusal(
          `No image ${id} in this chat. Use the image ids the person's messages list.`,
        );
      }
      return chatImageAttachment(image);
    });
  }

  /** The bytes of a plan's chat images, by `mailAttachmentKey`. */
  async bytes(planned: MailPlan, context: BotToolCallContext): Promise<MailLocalFiles> {
    const wanted = planned.attachments.flatMap((file) => (file.source === 'chat' ? [file] : []));
    if (wanted.length === 0) return new Map();
    const found = await this.images.findManyForBot(
      context.organizationId,
      context.botId,
      wanted.map((file) => file.attachmentId),
    );
    const files = new Map<string, Buffer>();
    for (const file of wanted) {
      const image = found.find((candidate) => candidate.id === file.attachmentId);
      const bytes = image ? await this.files.read(image.storageKey).catch(() => null) : null;
      if (!bytes) {
        throw new BotToolRefusal(
          `The image "${file.filename}" is gone from this chat; nothing was written.`,
        );
      }
      files.set(mailAttachmentKey(file), bytes);
    }
    return files;
  }
}
