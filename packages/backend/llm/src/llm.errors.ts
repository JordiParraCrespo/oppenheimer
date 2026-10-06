import type { LlmProviderId, LlmProviderSetting } from './llm.types';

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
 * from a timeout reads `code` and `status`.
 */
export class LlmError extends Error {
  override readonly name = 'LlmError';
  /** When a `rate_limited` provider may be called again. */
  readonly resetAt?: Date;

  constructor(
    readonly code: LlmErrorCode,
    readonly provider: LlmProviderId | LlmProviderSetting,
    message: string,
    readonly status?: number,
    options?: { cause?: unknown; resetAt?: Date },
  ) {
    super(message, options);
    this.resetAt = options?.resetAt;
  }
}
