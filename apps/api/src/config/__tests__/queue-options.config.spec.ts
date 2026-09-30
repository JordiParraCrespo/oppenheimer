import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JOB_OPTIONS,
  DURABLE_JOB_OPTIONS,
  EMAIL_JOB_OPTIONS,
} from '../queue-options.config';

/**
 * `@nestjs/bullmq` merges the root and a queue's options shallowly: a queue's
 * `defaultJobOptions` replace the root's whole. So every set a queue can be
 * given must carry the removal policy itself, or that queue keeps its jobs in
 * Redis for ever. Each set is pinned whole below, removal policy included.
 */
describe('queue job options', () => {
  it('keeps an hour of completed jobs and a week of failed ones by default', () => {
    expect(DEFAULT_JOB_OPTIONS).toEqual({
      removeOnComplete: { age: 3_600, count: 1_000 },
      removeOnFail: { age: 604_800 },
    });
  });

  it('retries email through transient provider failures, then drops it quickly', () => {
    expect(EMAIL_JOB_OPTIONS).toEqual({
      ...DEFAULT_JOB_OPTIONS,
      attempts: 5,
      backoff: { type: 'exponential', delay: 10_000 },
    });
  });

  it('keeps the durable retries and window for outbox-staged work', () => {
    expect(DURABLE_JOB_OPTIONS).toEqual({
      attempts: 8,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 86_400, count: 10_000 },
      removeOnFail: { age: 604_800 },
    });
  });
});
