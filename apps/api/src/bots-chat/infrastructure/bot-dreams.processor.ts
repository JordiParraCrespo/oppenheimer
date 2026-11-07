import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { LlmRateLimitError } from '@oppenheimer/backend-llm';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { DelayedError, type Job } from 'bullmq';
import { DreamBotMemoryCommand } from '../commands/dream-bot-memory/dream-bot-memory.command';
import { DREAM_BOT_MEMORY_JOB } from '../database/bot-memory-dream.repository';
import { summaryRetryAt } from '../domain/bot-summary.policy';

/**
 * The `bot-dreams` worker: one job per dream of a bot's memory, staged on the
 * outbox when a turn ends past the trigger or the owner asks. The queue
 * retries a job that throws (a model that failed); the write is refused when
 * the memory changed since the dream read it, so a retry or a second job
 * never writes over a newer memory. A rate limit on the workspace's key
 * delays this job alone until the reset, spending no attempt, as the summary
 * worker does (`.agents/rules/integrations.md`).
 */
@Processor(QUEUE_NAMES.BOT_DREAMS)
export class BotDreamsProcessor extends WorkerHost {
  private readonly logger = new Logger(BotDreamsProcessor.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(
    job: Job<{ organizationId?: string; botId?: string; force?: boolean }>,
    token?: string,
  ): Promise<void> {
    const { organizationId, botId, force } = job.data;
    if (job.name !== DREAM_BOT_MEMORY_JOB || !organizationId || !botId) {
      this.logger.warn({ message: 'Unknown bot-dreams job', jobName: job.name, jobId: job.id });
      return;
    }
    try {
      await this.commandBus.execute(
        new DreamBotMemoryCommand({ organizationId, botId, force: force === true }),
      );
    } catch (error) {
      if (!(error instanceof LlmRateLimitError)) throw error;
      const retryAt = summaryRetryAt(error.resetAt, new Date());
      this.logger.warn({
        message: 'A bot dream was refused for rate; delayed until the reset',
        botId,
        retryAt: retryAt.toISOString(),
      });
      await job.moveToDelayed(retryAt.getTime(), token);
      throw new DelayedError();
    }
  }
}
