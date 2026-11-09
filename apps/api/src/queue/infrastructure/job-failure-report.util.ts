import type { Job } from 'bullmq';

/** The name BullMQ gives the error that skips the remaining retries. */
const UNRECOVERABLE = 'UnrecoverableError';

/**
 * Whether a failure is the job's last: out of retries, or `UnrecoverableError`.
 * A failure BullMQ will still retry is not reported; the retry may pass, and
 * the one that does not is.
 */
export function isFinalFailure(job: Job | undefined, error: Error): boolean {
  const attempts = job?.opts.attempts ?? 1;
  const attemptsMade = job?.attemptsMade ?? attempts;
  return error?.name === UNRECOVERABLE || attemptsMade >= attempts;
}
