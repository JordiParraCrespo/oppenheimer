/**
 * Bucket bounds, in seconds, for HTTP response latency.
 *
 * Fifty milliseconds to five seconds: below the first bound every answer is
 * fast enough that the difference is noise, and past the last the caller has
 * usually given up, so the tail lands in `+Inf` where an alert can still see it.
 */
export const HTTP_LATENCY_BUCKETS_SECONDS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5];

/**
 * Bucket bounds, in milliseconds, for job and queue latency histograms.
 *
 * The range deliberately runs out to five minutes: a job that waits behind an
 * exponential backoff is a normal, observable state, and clipping those
 * observations into `+Inf` would hide exactly the latency worth alerting on.
 */
export const MILLISECOND_LATENCY_BUCKETS = [
  10, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 30_000, 60_000, 300_000,
];
