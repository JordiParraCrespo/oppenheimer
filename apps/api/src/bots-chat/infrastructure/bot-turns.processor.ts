import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Job } from 'bullmq';
import { DeliverBotAnswerCommand } from '../commands/deliver-bot-answer/deliver-bot-answer.command';
import { RunBotTurnCommand } from '../commands/run-bot-turn/run-bot-turn.command';
import { DELIVER_BOT_ANSWER_JOB, RUN_BOT_TURN_JOB } from '../database/bot-turn.repository';

/** How many turns one API process runs at once, across every bot. */
const TURNS_PER_PROCESS = 8;

/**
 * The `bot-turns` worker: one job per turn, staged on the outbox when the turn
 * becomes due, and one per ask that ended, which queues its answer on the
 * bot that asked (`DELIVER_BOT_ANSWER_JOB`). A turn runs for as long as the model works, so the job is not
 * retried on a failure: the turn records it, and a worker that died under one
 * leaves it running for the next pickup to fail.
 */
@Processor(QUEUE_NAMES.BOT_TURNS, { concurrency: TURNS_PER_PROCESS })
export class BotTurnsProcessor extends WorkerHost {
  private readonly logger = new Logger(BotTurnsProcessor.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(job: Job<{ turnId?: string }>): Promise<void> {
    const { turnId } = job.data;
    if (turnId && job.name === RUN_BOT_TURN_JOB) {
      await this.commandBus.execute(new RunBotTurnCommand({ turnId }));
      return;
    }
    if (turnId && job.name === DELIVER_BOT_ANSWER_JOB) {
      await this.commandBus.execute(new DeliverBotAnswerCommand({ turnId }));
      return;
    }
    this.logger.warn({ message: 'Unknown bot-turns job', jobName: job.name, jobId: job.id });
  }
}
