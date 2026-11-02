/**
 * Why a completion did not come back.
 *
 * - `not_configured` — the provider is `none` or lacks its key or base URL, or
 *   the call named no model and none is configured.
 * - `timeout` — the call ran past its `timeoutMs`.
 * - `aborted` — the caller's own signal cancelled it.
 * - `network` — the request never got an HTTP answer.
 * - `rate_limited` — the provider answered `429`, or an earlier `429` said to
 *   wait and it was not called again; `resetAt` says when it may be.
 * - `http` — it did, and the status was not 2xx (`status` says which).
 * - `invalid_response` — a 2xx whose body is not the shape the provider documents.
 */
export type LlmErrorCode =
  | 'not_configured'
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'rate_limited'
  | 'http'
  | 'invalid_response';

/**
 * The one error this package throws. A caller that treats a completion as
 * best-effort catches it and moves on; a caller that needs to tell a rate limit
 * from a timeout reads `code` and `status`, or checks for
 * {@link LlmRateLimitError}.
 *
 * `provider` is any string, not only this package's provider ids, because the
 * bot engines (`@oppenheimer/backend-agents`) raise the same rate-limit type.
 */
export class LlmError extends Error {
  override readonly name: string = 'LlmError';

  constructor(
    readonly code: LlmErrorCode,
    readonly provider: string,
    message: string,
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/**
 * A provider refused for rate or quota: the `rate_limited` {@link LlmError}.
 * The caller does not call it again before `resetAt`; `null` when the provider
 * did not say until when, and the caller picks a wait of its own.
 *
 * It is the one rate-limit type both model stacks raise: this package's
 * `complete`, and `BotEngine.complete` in `@oppenheimer/backend-agents`, so a
 * caller maps a rate limit once, whichever stack refused.
 */
export class LlmRateLimitError extends LlmError {
  override readonly name: string = 'LlmRateLimitError';

  constructor(
    provider: string,
    message: string,
    readonly resetAt: Date | null,
    options?: { cause?: unknown },
  ) {
    super('rate_limited', provider, message, 429, options);
  }
}
