import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Job } from 'bullmq';
import { SummarizeBotConversationCommand } from '../commands/summarize-bot-conversation/summarize-bot-conversation.command';
import { SUMMARIZE_BOT_CONVERSATION_JOB } from '../database/bot-conversation-summary.repository';

/**
 * The `bot-summaries` worker: one job per fold of a bot's oldest messages
 * into its summary, staged on the outbox when a turn ends past the threshold.
 * The queue retries a job that throws (`DURABLE_JOB_OPTIONS`, a model that
 * failed); the write is conditioned on the version it read, so a retry or a
 * second job never moves the summary back.
 */
@Processor(QUEUE_NAMES.BOT_SUMMARIES)
export class BotSummariesProcessor extends WorkerHost {
  private readonly logger = new Logger(BotSummariesProcessor.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(job: Job<{ organizationId?: string; botId?: string }>): Promise<void> {
    const { organizationId, botId } = job.data;
    if (job.name !== SUMMARIZE_BOT_CONVERSATION_JOB || !organizationId || !botId) {
      this.logger.warn({ message: 'Unknown bot-summaries job', jobName: job.name, jobId: job.id });
      return;
    }
    await this.commandBus.execute(new SummarizeBotConversationCommand({ organizationId, botId }));
  }
}
