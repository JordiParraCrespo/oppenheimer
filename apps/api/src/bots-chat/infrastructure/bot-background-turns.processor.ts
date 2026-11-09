import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Job } from 'bullmq';
import { RunBotTurnCommand } from '../commands/run-bot-turn/run-bot-turn.command';
import { RUN_BOT_TURN_JOB } from '../database/bot-turn.repository';

/** How many turns nobody waits on one API process runs at once, across every bot. */
const BACKGROUND_TURNS_PER_PROCESS = 8;

/**
 * The `bot-background-turns` worker: the turns nobody waits on (a goal's
 * continuation, a loop's run, a routine's), apart from the `bot-turns`
 * worker that runs the turns a person or another bot sent. A turn has no
 * time limit (`25-bots.md` §2), so a goal's turn may hold its slot for hours;
 * on its own queue it never holds one a message waits on. The run is the
 * same command either way.
 */
@Processor(QUEUE_NAMES.BOT_BACKGROUND_TURNS, { concurrency: BACKGROUND_TURNS_PER_PROCESS })
export class BotBackgroundTurnsProcessor extends WorkerHost {
  private readonly logger = new Logger(BotBackgroundTurnsProcessor.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(job: Job<{ turnId?: string }>): Promise<void> {
    const { turnId } = job.data;
    if (turnId && job.name === RUN_BOT_TURN_JOB) {
      await this.commandBus.execute(new RunBotTurnCommand({ turnId }));
      return;
    }
    this.logger.warn({
      message: 'Unknown bot-background-turns job',
      jobName: job.name,
      jobId: job.id,
    });
  }
}
