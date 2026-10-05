import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import { purgeInBatches } from '../../config/purge-in-batches';
import type { RetentionConfig } from '../../config/retention.config';

const SCHEDULER_ID = 'outbox-retention-daily';

/**
 * The nightly purge of delivered outbox rows past `retention.outboxDays`
 * (enough to answer "did this event go out?" about last week, short enough
 * that the table stays small), in batches through the BRIN index on
 * `createdAt`. A BullMQ job scheduler is one Redis entry, so it runs
 * once a day however many replicas there are. `pending` and `failed` rows are
 * never purged.
 */
@Processor(QUEUE_NAMES.OUTBOX_RETENTION)
export class OutboxRetentionProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(OutboxRetentionProcessor.name);

  constructor(
    private readonly outbox: OutboxService,
    @InjectQueue(QUEUE_NAMES.OUTBOX_RETENTION)
    private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // 04:53 UTC, away from the other purges.
    await this.queue.upsertJobScheduler(
      SCHEDULER_ID,
      { pattern: '53 4 * * *', tz: 'UTC' },
      { name: 'purge' },
    );
  }

  async process(): Promise<number> {
    const retention = this.config.getOrThrow<RetentionConfig>('retention');
    const cutoff = new Date(Date.now() - retention.outboxDays * 86_400_000);
    const rows = await purgeInBatches(
      (limit) => this.outbox.deleteProcessedBefore(cutoff, limit),
      retention,
    );
    this.logger.log({ message: 'outbox retention ran', rows });
    return rows;
  }
}
