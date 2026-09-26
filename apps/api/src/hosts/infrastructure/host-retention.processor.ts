import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import type { HostMetadataRepositoryPort } from '../database/host-metadata.repository.port';
import { HOST_METADATA_REPOSITORY } from '../hosts.di-tokens';

/** An IP address is personal data: where a laptop has been is kept this long past its last use. */
export const NETWORK_RETENTION_DAYS = 90;
/** The timeline is kept long enough to answer "what changed this season". */
export const TIMELINE_RETENTION_DAYS = 180;
/** Rows per statement, so a large purge never holds a long lock. */
export const RETENTION_BATCH = 5_000;
/** A ceiling per run: whatever is left is next day's. */
const MAX_BATCHES = 200;

const SCHEDULER_ID = 'host-retention-daily';

/**
 * Deletes what `product/versions/mvp/13-host-metadata.md` says is not kept:
 * networks unseen for 90 days (never a host's current one), timeline entries
 * past 180 days. Both go in batches through their own index, as the
 * migration's Q7 and Q8.
 *
 * Scheduled through BullMQ rather than a timer in each process: the job
 * scheduler is one entry in Redis, so however many API replicas run, the
 * purge runs once a day. Upserting it at boot is idempotent.
 */
@Processor(QUEUE_NAMES.HOST_RETENTION)
export class HostRetentionProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(HostRetentionProcessor.name);

  constructor(
    @Inject(HOST_METADATA_REPOSITORY)
    private readonly metadata: HostMetadataRepositoryPort,
    @InjectQueue(QUEUE_NAMES.HOST_RETENTION)
    private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // 03:17 UTC: off the hour, when every other cron in the world fires.
    await this.queue.upsertJobScheduler(
      SCHEDULER_ID,
      { pattern: '17 3 * * *', tz: 'UTC' },
      { name: 'purge' },
    );
  }

  async process(): Promise<{ networks: number; timeline: number }> {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const networks = await this.drain((batch) =>
      this.metadata.deleteNetworksUnseenSince(new Date(now - NETWORK_RETENTION_DAYS * day), batch),
    );
    const timeline = await this.drain((batch) =>
      this.metadata.deleteTimelineBefore(new Date(now - TIMELINE_RETENTION_DAYS * day), batch),
    );
    this.logger.log({ message: 'host retention ran', networks, timeline });
    return { networks, timeline };
  }

  private async drain(deleteBatch: (batch: number) => Promise<number>): Promise<number> {
    let total = 0;
    for (let i = 0; i < MAX_BATCHES; i += 1) {
      const deleted = await deleteBatch(RETENTION_BATCH);
      total += deleted;
      if (deleted < RETENTION_BATCH) break;
    }
    return total;
  }
}
