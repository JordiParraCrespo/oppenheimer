import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import { AUTOMATION_RUN_REPOSITORY } from '../automations.di-tokens';
import type { AutomationRunRepositoryPort } from '../database/automation-run.repository.port';

/** Runs are kept this long: the chart shows 30 days; the rest is for debugging and audit. */
export const RUN_RETENTION_DAYS = 180;
const BATCH = 5_000;
const MAX_BATCHES = 200;
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
    const cutoff = new Date(Date.now() - RUN_RETENTION_DAYS * 86_400_000);
    let total = 0;
    for (let i = 0; i < MAX_BATCHES; i += 1) {
      const deleted = await this.runs.deleteBefore(cutoff, BATCH);
      total += deleted;
      if (deleted < BATCH) break;
    }
    this.logger.log({ message: 'automation retention ran', runs: total });
    return total;
  }
}
