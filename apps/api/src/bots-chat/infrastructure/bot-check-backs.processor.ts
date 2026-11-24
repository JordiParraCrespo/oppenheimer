import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Job } from 'bullmq';
import { BotTurnMapper } from '../bot-turn.mapper';
import { WakeOnCheckBackCommand } from '../commands/wake-on-check-back/wake-on-check-back.command';
import { WAKE_ON_CHECK_BACK_JOB } from './outbox-bot-check-backs.adapter';

/**
 * The `bot-check-backs` worker: one job per look a bot asked for with
 * `check_back`, staged on the outbox to run at its time. The queue retries a
 * job that throws (`DURABLE_JOB_OPTIONS`); the turn it queues is keyed by the
 * chain and the step, so a retry wakes the bot once.
 */
@Processor(QUEUE_NAMES.BOT_CHECK_BACKS)
export class BotCheckBacksProcessor extends WorkerHost {
  private readonly logger = new Logger(BotCheckBacksProcessor.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly mapper: BotTurnMapper,
  ) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    const look = job.name === WAKE_ON_CHECK_BACK_JOB ? this.mapper.toCheckBack(job.data) : null;
    if (!look) {
      this.logger.warn({
        message: 'Unknown bot-check-backs job',
        jobName: job.name,
        jobId: job.id,
      });
      return;
    }
    await this.commandBus.execute(new WakeOnCheckBackCommand({ look }));
  }
}
