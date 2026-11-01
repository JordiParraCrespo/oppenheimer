/**
 * Bucket bounds, in seconds, for HTTP response latency.
 *
 * Fifty milliseconds to five seconds: below the first bound every answer is
 * fast enough that the difference is noise, and past the last the caller has
 * usually given up, so the tail lands in `+Inf` where an alert can still see it.
 */
export const HTTP_LATENCY_BUCKETS_SECONDS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5];
