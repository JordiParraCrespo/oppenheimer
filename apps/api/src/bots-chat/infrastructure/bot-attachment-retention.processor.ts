import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import { purgeInBatches } from '../../config/purge-in-batches';
import type { RetentionConfig } from '../../config/retention.config';
import { BOT_ATTACHMENT_FILES, BOT_ATTACHMENT_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotAttachmentRepositoryPort } from '../database/bot-attachment.repository.port';
import { BOT_ATTACHMENT_UNSENT_TTL_MS } from '../domain/bot-attachment.entity';
import type { BotAttachmentFilesPort } from './bot-attachment-files.port';

const SCHEDULER_ID = 'bot-attachment-retention-daily';

/**
 * The daily sweep of chat images (`25-bots.md` §3.1) no message carries that
 * are older than a day: uploads never sent, and images whose message was
 * cleared or whose bot or workspace was deleted. A file in storage outlives
 * any cascade, so the row waits for this: the file first, then the row, in
 * batches through `IDX_bot_attachment_unclaimed`. A row whose file could not
 * be deleted is left for the next night. A send cannot claim an image this
 * old (`BOT_ATTACHMENT_SEND_WINDOW_MS`), so no file is deleted under a
 * message that just claimed it. A BullMQ job scheduler is one Redis
 * entry, so it runs once a day however many replicas there are.
 */
@Processor(QUEUE_NAMES.BOT_ATTACHMENT_RETENTION)
export class BotAttachmentRetentionProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(BotAttachmentRetentionProcessor.name);

  constructor(
    @Inject(BOT_ATTACHMENT_REPOSITORY) private readonly attachments: BotAttachmentRepositoryPort,
    @Inject(BOT_ATTACHMENT_FILES) private readonly files: BotAttachmentFilesPort,
    @InjectQueue(QUEUE_NAMES.BOT_ATTACHMENT_RETENTION)
    private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // 05:29 UTC, away from the other purges.
    await this.queue.upsertJobScheduler(
      SCHEDULER_ID,
      { pattern: '29 5 * * *', tz: 'UTC' },
      { name: 'purge' },
    );
  }

  async process(): Promise<{ attachments: number }> {
    const cutoff = new Date(Date.now() - BOT_ATTACHMENT_UNSENT_TTL_MS);
    const attachments = await purgeInBatches(async (limit) => {
      const batch = await this.attachments.findUnclaimedBefore(cutoff, limit);
      const removed: string[] = [];
      for (const attachment of batch) {
        try {
          await this.files.remove(attachment.storageKey);
          removed.push(attachment.id);
        } catch (error) {
          this.logger.warn({
            message: 'A chat image could not be deleted from storage',
            attachmentId: attachment.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      await this.attachments.deleteUnclaimed(removed);
      // A short batch, failures included, ends the night's sweep.
      return removed.length;
    }, this.config.getOrThrow<RetentionConfig>('retention'));
    this.logger.log({ message: 'bot attachment retention ran', attachments });
    return { attachments };
  }
}
