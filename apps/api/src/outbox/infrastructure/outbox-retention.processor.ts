import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';

/**
 * Delivered outbox rows are kept this long: enough to answer "did this event
 * go out?" about last week, short enough that the table stays small.
 */
export const OUTBOX_RETENTION_DAYS = 7;
export const OUTBOX_RETENTION_BATCH = 5_000;
const MAX_BATCHES = 200;
const SCHEDULER_ID = 'outbox-retention-daily';

/**
 * The nightly purge of delivered outbox rows, in batches through the BRIN
 * index on `createdAt`. A BullMQ job scheduler is one Redis entry, so it runs
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
    const cutoff = new Date(Date.now() - OUTBOX_RETENTION_DAYS * 86_400_000);
    let total = 0;
    for (let i = 0; i < MAX_BATCHES; i += 1) {
      const deleted = await this.outbox.deleteProcessedBefore(cutoff, OUTBOX_RETENTION_BATCH);
      total += deleted;
      if (deleted < OUTBOX_RETENTION_BATCH) break;
    }
    this.logger.log({ message: 'outbox retention ran', rows: total });
    return total;
  }
}
