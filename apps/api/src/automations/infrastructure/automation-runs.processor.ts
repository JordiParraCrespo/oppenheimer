import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Job } from 'bullmq';
import { DispatchAutomationRunCommand } from '../commands/dispatch-automation-run/dispatch-automation-run.command';
import { DISPATCH_RUN_JOB } from '../database/automation-run.repository';

/**
 * Dispatches runs. Each job is staged on the outbox in the transaction that
 * created or deferred its run, so a run is never queued in the database and
 * lost on its way to Redis; BullMQ owns the retries of a dispatch that faulted.
 */
@Processor(QUEUE_NAMES.AUTOMATION_RUNS, { concurrency: 4 })
export class AutomationRunsProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationRunsProcessor.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(job: Job<{ runId?: string }>): Promise<unknown> {
    if (job.name !== DISPATCH_RUN_JOB || !job.data.runId) {
      this.logger.warn({ message: 'Unknown automation-runs job', name: job.name });
      return null;
    }
    return this.commandBus.execute(new DispatchAutomationRunCommand({ runId: job.data.runId }));
  }
}
