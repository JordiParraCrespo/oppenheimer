import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import { purgeInBatches } from '../../config/purge-in-batches';
import type { RetentionConfig } from '../../config/retention.config';
import type { HostMetadataRepositoryPort } from '../database/host-metadata.repository.port';
import { HOST_METADATA_REPOSITORY } from '../hosts.di-tokens';

const SCHEDULER_ID = 'host-retention-daily';

/**
 * Deletes what `product/versions/mvp/15-host-metadata.md` says is not kept: networks
 * unseen for `retention.hostNetworkDays` (never a host's current one) and timeline
 * entries past `retention.hostTimelineDays`, in batches through their own index, as
 * the migration's Q7 and Q8.
 *
 * A BullMQ job scheduler, not a timer per process: one entry in Redis, so however
 * many replicas run, the purge runs once a day. Upserting it at boot is idempotent.
 */
@Processor(QUEUE_NAMES.HOST_RETENTION)
export class HostRetentionProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(HostRetentionProcessor.name);

  constructor(
    @Inject(HOST_METADATA_REPOSITORY)
    private readonly metadata: HostMetadataRepositoryPort,
    @InjectQueue(QUEUE_NAMES.HOST_RETENTION)
    private readonly queue: Queue,
    private readonly config: ConfigService,
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
    const retention = this.config.getOrThrow<RetentionConfig>('retention');
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    // An IP address is personal data: where a laptop has been is kept only so
    // long past its last use. The timeline answers "what changed this season".
    const networkCutoff = new Date(now - retention.hostNetworkDays * day);
    const timelineCutoff = new Date(now - retention.hostTimelineDays * day);
    const networks = await purgeInBatches(
      (limit) => this.metadata.deleteNetworksUnseenSince(networkCutoff, limit),
      retention,
    );
    const timeline = await purgeInBatches(
      (limit) => this.metadata.deleteTimelineBefore(timelineCutoff, limit),
      retention,
    );
    this.logger.log({ message: 'host retention ran', networks, timeline });
    return { networks, timeline };
  }
}
