import type { ErrorReportContext } from '@oppenheimer/backend-error-reporting';
import type { Job } from 'bullmq';

/** The name BullMQ gives the error that skips the remaining retries. */
const UNRECOVERABLE = 'UnrecoverableError';

/**
 * What a job failure is reported with, or null while BullMQ will still retry
 * it. Grouped by queue and job name rather than by stack: one job type failing
 * a thousand times is one issue. The job's data is not attached; it can hold
 * addresses and tokenized links (see `EMAIL_JOB_OPTIONS`), and its id finds
 * it in Bull Board for the week failures are kept.
 */
export function jobFailureReportOf(
  queue: string,
  job: Job | undefined,
  error: Error,
): ErrorReportContext | null {
  const attempts = job?.opts.attempts ?? 1;
  const attemptsMade = job?.attemptsMade ?? attempts;
  const final = error?.name === UNRECOVERABLE || attemptsMade >= attempts;
  if (!final) return null;
  const name = job?.name ?? 'unknown';
  return {
    level: 'error',
    tags: { 'queue.name': queue, 'queue.job': name, 'queue.attempts': attemptsMade },
    extra: { jobId: job?.id, failedReason: job?.failedReason },
    fingerprint: ['queue-job-failed', queue, name, error?.name ?? 'Error'],
  };
}
