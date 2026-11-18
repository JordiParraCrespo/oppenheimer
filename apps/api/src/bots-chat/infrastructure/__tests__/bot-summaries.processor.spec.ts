import type { CommandBus } from '@nestjs/cqrs';
import { BotCompletionError } from '@oppenheimer/backend-agents';
import { LlmRateLimitError } from '@oppenheimer/backend-llm';
import { DelayedError, type Job } from 'bullmq';
import { SummarizeBotConversationCommand } from '../../commands/summarize-bot-conversation/summarize-bot-conversation.command';
import { SUMMARIZE_BOT_CONVERSATION_JOB } from '../../database/bot-conversation-summary.repository';
import { BotSummariesProcessor } from '../bot-summaries.processor';

/**
 * The `bot-summaries` worker: a job runs the summarize command; a provider that
 * refused for rate moves the job to delayed until the reset it named, without
 * spending an attempt; a provider that refused the account ends the job
 * quietly; any other failure goes back to the queue's retries.
 */
function setup(...outcomes: (() => Promise<unknown>)[]) {
  const commandBus = { execute: vi.fn() };
  for (const outcome of outcomes) commandBus.execute.mockImplementationOnce(outcome);
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

  // What breaks this: Sentry OPPENHEIMER-API-7, a workspace out of credit
  // reported once per summary job after eight retries, for every turn that
  // ended while it was out. Resolving ends the job: no retry, and the job
  // failure reporter never sees it.
  it.each(['usage_limit', 'credential'] as const)(
    'ends the job without a retry when the provider refused the account (%s)',
    async (failure) => {
      const { process, job } = setup(async () => {
        throw new BotCompletionError('Credit balance is too low', failure);
      });
      await expect(process()).resolves.toBeUndefined();
      expect(job.moveToDelayed).not.toHaveBeenCalled();
    },
  );

  // The quiet end must not hide our own faults, nor a provider that is down.
  it.each(['refused', 'unavailable', 'other', null] as const)(
    'hands a %s completion failure back to the queue’s retries',
    async (failure) => {
      const { process } = setup(async () => {
        throw new BotCompletionError('The completion failed', failure);
      });
      await expect(process()).rejects.toBeInstanceOf(BotCompletionError);
    },
  );

  it('summarizes again on the next job once the account is sorted', async () => {
    const { process, commandBus } = setup(
      async () => {
        throw new BotCompletionError('Credit balance is too low', 'usage_limit');
      },
      async () => undefined,
    );
    await process();
    await expect(process()).resolves.toBeUndefined();
    expect(commandBus.execute).toHaveBeenCalledTimes(2);
  });
});
