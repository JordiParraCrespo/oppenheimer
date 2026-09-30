/**
 * The brake on made-up credentials.
 *
 * The rate limiter buckets a bearer caller by a digest of what it presents,
 * without a lookup: free of database work, but a caller spraying random
 * strings opens a fresh bucket per request. So every refused credential counts
 * against its address, and an address past its budget is refused before any
 * lookup, except for a credential that recently succeeded, so one
 * misconfigured client behind a shared address does not lock out its
 * neighbours.
 *
 * The kernel records; `throttling` binds the counter. Best-effort: a counter
 * that cannot be reached neither fails a request nor refuses one.
 */
export interface AuthFailureLimiterPort {
  recordFailure(ip: string): void;

  /** The credential behind this rate-limit key was just accepted. */
  recordSuccess(credentialKey: string): void;

  /**
   * Seconds until `ip` may present credentials again, or `0` if it may now —
   * which it always may with a credential that has recently succeeded.
   */
  retryAfter(ip: string, credentialKey: string): Promise<number>;
}
