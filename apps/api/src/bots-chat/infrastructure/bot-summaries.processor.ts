import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { BotCompletionError } from '@oppenheimer/backend-agents';
import { LlmRateLimitError } from '@oppenheimer/backend-llm';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { DelayedError, type Job } from 'bullmq';
import { SummarizeBotConversationCommand } from '../commands/summarize-bot-conversation/summarize-bot-conversation.command';
import { SUMMARIZE_BOT_CONVERSATION_JOB } from '../database/bot-conversation-summary.repository';
import { type SummaryRefusal, summaryOutcome } from '../domain/bot-summary.policy';

/**
 * The `bot-summaries` worker: one job per fold of a bot's oldest messages
 * into its summary, staged on the outbox when a turn ends past the threshold.
 * The queue retries a job that throws (`DURABLE_JOB_OPTIONS`, a model that
 * failed); the write is conditioned on the version it read, so a retry or a
 * second job never moves the summary back.
 *
 * What a failed fold comes to is `summaryOutcome`'s: a rate limit moves this
 * job alone to delayed until the reset (the limit is the workspace key's, so
 * the queue's other workspaces carry on), a refusal of the account ends it
 * with no retry and no report, and anything else goes to the retries.
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
      const outcome = summaryOutcome(refusalOf(error), new Date());
      switch (outcome.kind) {
        case 'retry':
          throw error;
        case 'end':
          this.logger.warn({
            message: 'A bot summary was refused for the account; left for the next turn',
            botId,
            failure: outcome.failure,
          });
          return;
        case 'delay':
          this.logger.warn({
            message: 'A bot summary was refused for rate; delayed until the reset',
            botId,
            retryAt: outcome.until.toISOString(),
          });
          await job.moveToDelayed(outcome.until.getTime(), token);
          throw new DelayedError();
      }
    }
  }
}

/** What a completion's rejection says about why, in the terms `summaryOutcome` reads. */
function refusalOf(error: unknown): SummaryRefusal | null {
  if (error instanceof LlmRateLimitError) return { failure: 'rate_limit', resetAt: error.resetAt };
  if (error instanceof BotCompletionError) return { failure: error.failure };
  return null;
}
