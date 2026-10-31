import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Job } from 'bullmq';
import { CheckStalledSessionCommand } from '../commands/check-stalled-session/check-stalled-session.command';
import { CHECK_STALLED_SESSION_JOB } from './outbox-bot-stall-checks.adapter';

/**
 * The `bot-stall-checks` worker: one job per task a bot hands a session,
 * staged on the outbox to run a few minutes later (`27-bot-subscriptions.md`
 * §4.1). The queue retries a job that throws (`DURABLE_JOB_OPTIONS`); the
 * wake it may queue is keyed by the subscription and the task, so a retry
 * tells the bot once.
 */
@Processor(QUEUE_NAMES.BOT_STALL_CHECKS)
export class BotStallChecksProcessor extends WorkerHost {
  private readonly logger = new Logger(BotStallChecksProcessor.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(job: Job<{ subscriptionId?: string; turn?: number }>): Promise<void> {
    const { subscriptionId, turn } = job.data;
    if (job.name !== CHECK_STALLED_SESSION_JOB || !subscriptionId || !Number.isInteger(turn)) {
      this.logger.warn({
        message: 'Unknown bot-stall-checks job',
        jobName: job.name,
        jobId: job.id,
      });
      return;
    }
    await this.commandBus.execute(
      new CheckStalledSessionCommand({ subscriptionId, turn: turn as number }),
    );
  }
}
