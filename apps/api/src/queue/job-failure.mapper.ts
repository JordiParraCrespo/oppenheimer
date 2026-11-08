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
}
