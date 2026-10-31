import type { CommandBus } from '@nestjs/cqrs';
import { LlmRateLimitError } from '@oppenheimer/backend-llm';
import { DelayedError, type Job } from 'bullmq';
import { SummarizeBotConversationCommand } from '../../commands/summarize-bot-conversation/summarize-bot-conversation.command';
import { SUMMARIZE_BOT_CONVERSATION_JOB } from '../../database/bot-conversation-summary.repository';
import { BotSummariesProcessor } from '../bot-summaries.processor';

/**
 * The `bot-summaries` worker: a job runs the summarize command; a provider
 * that refused for rate moves the job to delayed until the reset it named,
 * without spending an attempt (`.agents/rules/integrations.md`), where any
 * other failure goes back to the queue's retries.
 */
function setup(outcome: () => Promise<unknown>) {
  const commandBus = { execute: vi.fn(outcome) };
  const job = {
    id: 'job-1',
    name: SUMMARIZE_BOT_CONVERSATION_JOB,
    data: { organizationId: 'org-1', botId: 'bot-1' },
    moveToDelayed: vi.fn(async () => undefined),
  };
  const processor = new BotSummariesProcessor(commandBus as unknown as CommandBus);
  return {
    commandBus,
    job,
    process: () => processor.process(job as unknown as Job, 'token-1'),
  };
}

describe('BotSummariesProcessor', () => {
  it('runs the summarize command for the job’s bot', async () => {
    const { process, commandBus, job } = setup(async () => undefined);
    await process();
    expect(commandBus.execute).toHaveBeenCalledWith(expect.any(SummarizeBotConversationCommand));
    expect(commandBus.execute.mock.calls[0][0]).toMatchObject({
      organizationId: 'org-1',
      botId: 'bot-1',
    });
    expect(job.moveToDelayed).not.toHaveBeenCalled();
  });

  it('delays the job until the provider’s reset on a refusal for rate, spending no attempt', async () => {
    const resetAt = new Date(Date.now() + 5 * 60_000);
    const { process, job } = setup(async () => {
      throw new LlmRateLimitError('anthropic', '429 rate limit reached', resetAt);
    });
    await expect(process()).rejects.toBeInstanceOf(DelayedError);
    expect(job.moveToDelayed).toHaveBeenCalledWith(resetAt.getTime(), 'token-1');
  });

  it('delays a minute when the refusal named no reset', async () => {
    const before = Date.now();
    const { process, job } = setup(async () => {
      throw new LlmRateLimitError('chatgpt', 'quota exceeded', null);
    });
    await expect(process()).rejects.toBeInstanceOf(DelayedError);
    const [at] = job.moveToDelayed.mock.calls[0] as unknown as [number];
    expect(at).toBeGreaterThanOrEqual(before + 60_000);
  });

  it('hands any other failure back to the queue’s retries', async () => {
    const { process, job } = setup(async () => {
      throw new Error('model unavailable');
    });
    await expect(process()).rejects.toThrow('model unavailable');
    expect(job.moveToDelayed).not.toHaveBeenCalled();
  });
});
