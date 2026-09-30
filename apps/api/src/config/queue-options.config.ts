import type { DefaultJobOptions } from 'bullmq';

/**
 * The job options every BullMQ queue in the API is created with (the root defaults,
 * `BullModule.forRootAsync` in `app.module.ts`).
 *
 * BullMQ keeps completed and failed jobs in Redis until told otherwise: the one-minute
 * automation tick alone adds 1,440 jobs a day, and email jobs carry recipient
 * addresses and tokenized URLs. An hour of completed jobs still covers the outbox
 * relay's `jobId` deduplication window (a reclaimed row re-adds the same id); failures
 * stay a week for Bull Board.
 *
 * A queue's own `defaultJobOptions` replace these whole (`@nestjs/bullmq` merges
 * shallowly), so every per-queue constant below spells the removal policy out again.
 * This lives in `src/config` because the auth kernel's standalone email queue must
 * carry the same options.
 */
export const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: { age: 60 * 60, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
} as const satisfies DefaultJobOptions;

/**
 * Retries for work whose owing row lives in Postgres. The outbox marks a row
 * processed once the job is added, so the retries are the queue's: a job that
 * throws on a transient fault (the database, GitHub, a session create) is
 * tried again with backoff. What outlives the retries — or a Redis entry lost
 * outright — is re-staged by each module's sweep, from the rows still owed.
 */
export const DURABLE_JOB_OPTIONS = {
  attempts: 8,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 24 * 60 * 60, count: 10_000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
} as const satisfies DefaultJobOptions;

/**
 * Email: retried through transient provider failures (an SMTP or Resend 5xx,
 * a DNS blip, a timeout), then dropped from Redis quickly — the payloads hold
 * addresses and tokenized reset, verification and invitation URLs. Five
 * attempts at 10 s exponential span about 2.5 minutes, well inside a reset
 * link's lifetime. Both producers use it: the DI-registered queue
 * (`QueueModule`) and Better Auth's standalone one (`email-queue.util.ts`).
 */
export const EMAIL_JOB_OPTIONS = {
  ...DEFAULT_JOB_OPTIONS,
  attempts: 5,
  backoff: { type: 'exponential', delay: 10_000 },
} as const satisfies DefaultJobOptions;
