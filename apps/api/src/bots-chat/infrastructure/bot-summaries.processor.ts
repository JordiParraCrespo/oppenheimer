import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { BotRateLimitError } from '@oppenheimer/backend-agents';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { DelayedError, type Job } from 'bullmq';
import { SummarizeBotConversationCommand } from '../commands/summarize-bot-conversation/summarize-bot-conversation.command';
import { SUMMARIZE_BOT_CONVERSATION_JOB } from '../database/bot-conversation-summary.repository';
import { summaryRetryAt } from '../domain/bot-summary.policy';

/**
 * The `bot-summaries` worker: one job per fold of a bot's oldest messages
 * into its summary, staged on the outbox when a turn ends past the threshold.
 * The queue retries a job that throws (`DURABLE_JOB_OPTIONS`, a model that
 * failed); the write is conditioned on the version it read, so a retry or a
 * second job never moves the summary back.
 *
 * A provider that refused for rate or quota (`BotRateLimitError`) is not
 * retried on that schedule (`.agents/rules/integrations.md`): the limit is
 * the workspace key's, so this job alone moves to delayed until the reset the
 * provider named (`summaryRetryAt`), spending no attempt, and the queue's
 * other workspaces carry on.
 */
@Processor(QUEUE_NAMES.BOT_SUMMARIES)
export class BotSummariesProcessor extends WorkerHost {
  private readonly logger = new Logger(BotSummariesProcessor.name);

  constructor(private readonly commandBus: CommandBus) {
    super();
  }

  async process(
    job: Job<{ organizationId?: string; botId?: string }>,
    token?: string,
  ): Promise<void> {
    const { organizationId, botId } = job.data;
    if (job.name !== SUMMARIZE_BOT_CONVERSATION_JOB || !organizationId || !botId) {
      this.logger.warn({ message: 'Unknown bot-summaries job', jobName: job.name, jobId: job.id });
      return;
    }
    try {
      await this.commandBus.execute(new SummarizeBotConversationCommand({ organizationId, botId }));
    } catch (error) {
      if (!(error instanceof BotRateLimitError)) throw error;
      const retryAt = summaryRetryAt(error.resetAt, new Date());
      this.logger.warn({
        message: 'A bot summary was refused for rate; delayed until the reset',
        botId,
        retryAt: retryAt.toISOString(),
      });
      await job.moveToDelayed(retryAt.getTime(), token);
      throw new DelayedError();
    }
  }
}
