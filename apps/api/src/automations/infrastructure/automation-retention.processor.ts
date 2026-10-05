import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import { purgeInBatches } from '../../config/purge-in-batches';
import type { RetentionConfig } from '../../config/retention.config';
import { AUTOMATION_RUN_REPOSITORY } from '../automations.di-tokens';
import type { AutomationRunRepositoryPort } from '../database/automation-run.repository.port';

const SCHEDULER_ID = 'automation-retention-daily';

/**
 * The nightly purge of runs past `retention.automationRunDays`, in batches
 * through the time index. The chart reads 90 days at most; the rest is for
 * debugging and audit.
 */
@Processor(QUEUE_NAMES.AUTOMATION_RETENTION)
export class AutomationRetentionProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(AutomationRetentionProcessor.name);

  constructor(
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
    @InjectQueue(QUEUE_NAMES.AUTOMATION_RETENTION)
    private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    // 04:41 UTC, away from the other purges.
    await this.queue.upsertJobScheduler(
      SCHEDULER_ID,
      { pattern: '41 4 * * *', tz: 'UTC' },
      { name: 'purge' },
    );
  }

  async process(): Promise<number> {
    const retention = this.config.getOrThrow<RetentionConfig>('retention');
    const cutoff = new Date(Date.now() - retention.automationRunDays * 86_400_000);
    const runs = await purgeInBatches((limit) => this.runs.deleteBefore(cutoff, limit), retention);
    this.logger.log({ message: 'automation retention ran', runs });
    return runs;
  }
}
