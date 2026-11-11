/**
 * The mechanisms `@sentry/nestjs` stamps on what it captures from a
 * `@Processor`'s `process()`: it wraps every processor and reports each throw
 * as unhandled, with (`auto.queue.orchestrion.nestjs.bullmq`) or without
 * orchestrion.
 */
const JOB_ATTEMPT_MECHANISMS = new Set([
  'auto.queue.nestjs.bullmq',
  'auto.queue.orchestrion.nestjs.bullmq',
]);

/** The fields of a Sentry event this reads. */
export interface JobAttemptCandidate {
  exception?: { values?: { mechanism?: { type?: string } }[] };
}

/**
 * Whether the event is Sentry's own capture of one attempt of a queued job.
 * Those are not sent: a throw from `process()` is one attempt, not a verdict.
 * BullMQ retries it, and a `DelayedError` or `RateLimitError` is how a worker
 * waits, not a failure, yet each one became an unhandled issue. The API
 * reports a job once, when it fails for good, grouped by queue and job
 * (`JobFailureReportingAdapter`).
 */
export function isJobAttemptEvent(event: JobAttemptCandidate): boolean {
  return (
    event.exception?.values?.some((value) =>
      JOB_ATTEMPT_MECHANISMS.has(value.mechanism?.type ?? ''),
    ) ?? false
  );
}
