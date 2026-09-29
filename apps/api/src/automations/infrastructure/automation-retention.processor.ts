import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import { AUTOMATION_RUN_REPOSITORY } from '../automations.di-tokens';
import type { AutomationRunRepositoryPort } from '../database/automation-run.repository.port';

const SCHEDULER_ID = 'automation-retention-daily';

/** The nightly purge of runs past their retention, in batches through the time index. */
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
    const cutoff = new Date(Date.now() - this.runRetentionDays * 86_400_000);
    const batchSize = this.batchSize;
    const maxBatches = this.maxBatches;
    let total = 0;
    for (let i = 0; i < maxBatches; i += 1) {
      const deleted = await this.runs.deleteBefore(cutoff, batchSize);
      total += deleted;
      if (deleted < batchSize) break;
    }
    this.logger.log({ message: 'automation retention ran', runs: total });
    return total;
  }

  /** Runs are kept this long: the chart shows 30 days; the rest is for debugging and audit. */
  private get runRetentionDays(): number {
    return this.config.getOrThrow<number>('retention.automationRunDays');
  }

  private get batchSize(): number {
    return this.config.getOrThrow<number>('retention.batchSize');
  }

  private get maxBatches(): number {
    return this.config.getOrThrow<number>('retention.maxBatches');
  }
}
