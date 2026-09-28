/**
 * The brake on made-up credentials.
 *
 * The rate limiter buckets a bearer caller by a digest of what it presents,
 * without looking the credential up — which is what keeps it free of database
 * work, and what would let a caller spraying random strings open a fresh
 * bucket per request. This is the other half: every refused credential counts
 * against the address it came from, and an address past its budget is refused
 * before any lookup — except for a credential that has recently succeeded, so
 * one misconfigured client behind a shared address does not lock out the
 * callers beside it.
 *
 * The kernel records; `throttling` binds the counter and asks it. Every method
 * is best-effort: a counter that cannot be reached neither fails a request nor
 * refuses one.
 */
export interface AuthFailureLimiterPort {
  /** A credential presented from `ip` was refused. */
  recordFailure(ip: string): void;

  /** The credential behind this rate-limit key was just accepted. */
  recordSuccess(credentialKey: string): void;

  /**
   * Seconds until `ip` may present credentials again, or `0` if it may now —
   * which it always may with a credential that has recently succeeded.
   */
  retryAfter(ip: string, credentialKey: string): Promise<number>;
}
