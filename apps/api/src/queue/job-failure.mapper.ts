import type { ErrorReportContext } from '@oppenheimer/backend-error-reporting';
import type { Job } from 'bullmq';

/**
 * A failed job as an error report: grouped by queue and job name rather than
 * by stack, so one job type failing a thousand times is one issue. The job's
 * data is not attached: it can hold addresses and tokenized links (see
 * `EMAIL_JOB_OPTIONS`); its id finds it in Bull Board for the week failures
 * are kept.
 */
export class JobFailureMapper {
  static toErrorReport(queue: string, job: Job | undefined, error: Error): ErrorReportContext {
    const name = job?.name ?? 'unknown';
    return {
      level: 'error',
      tags: {
        'queue.name': queue,
        'queue.job': name,
        'queue.attempts': job?.attemptsMade ?? job?.opts.attempts ?? 1,
      },
      extra: { jobId: job?.id, failedReason: job?.failedReason },
      fingerprint: ['queue-job-failed', queue, name, error?.name ?? 'Error'],
    };
  }

  /**
   * The error a final failure is reported with: a fresh one with the failed
   * job's name, message, stack and cause. The worker's own error may already
   * have been captured by the error tracker's wrapper around `process()`.
   * That capture is dropped (`isJobAttemptEvent`), but the tracker would still
   * skip a second capture of the same object, and the job's one report would
   * never leave (OPPENHEIMER-API-5).
   */
  static toReportedError(error: Error): Error {
    const cause: unknown = error?.cause;
    const reported = new Error(
      String(error?.message ?? error),
      cause === undefined ? undefined : { cause },
    );
    reported.name = error?.name ?? 'Error';
    if (error?.stack) reported.stack = error.stack;
    return reported;
  }
}
