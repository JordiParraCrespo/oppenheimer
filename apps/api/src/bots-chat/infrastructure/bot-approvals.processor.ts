import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Job } from 'bullmq';
import { RunApprovedCallCommand } from '../commands/run-approved-call/run-approved-call.command';
import { RUN_APPROVED_CALL_JOB } from '../database/bot-approval.repository';

/**
 * The `bot-approvals` worker: one job per approved call, staged on the outbox
 * in the same transaction as the yes. The queue retries a job that throws
 * (`DURABLE_JOB_OPTIONS`); the call is keyed by its approval and its result is
 * written once, so a retry never runs it twice.
 */
@Processor(QUEUE_NAMES.BOT_APPROVALS)
export class BotApprovalsProcessor extends WorkerHost {
  private readonly logger = new Logger(BotApprovalsProcessor.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(job: Job<{ approvalId?: string; by?: string }>): Promise<void> {
    if (job.name !== RUN_APPROVED_CALL_JOB || !job.data.approvalId) {
      this.logger.warn({ message: 'Unknown bot-approvals job', jobName: job.name, jobId: job.id });
      return;
    }
    await this.commandBus.execute(
      new RunApprovedCallCommand({ approvalId: job.data.approvalId, by: job.data.by ?? '' }),
    );
  }
}
