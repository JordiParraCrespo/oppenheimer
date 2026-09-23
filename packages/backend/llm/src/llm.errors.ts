import type { LlmProviderId, LlmProviderSetting } from './llm.types';

/**
 * Why a completion did not come back.
 *
 * - `not_configured` — the deployment has no provider, or the call named no model.
 * - `timeout` — the call ran past its `timeoutMs`.
 * - `aborted` — the caller's own signal cancelled it.
 * - `network` — the request never got an HTTP answer.
 * - `http` — it did, and the status was not 2xx (`status` says which).
 * - `invalid_response` — a 2xx whose body is not the shape the provider documents.
 */
export type LlmErrorCode =
  | 'not_configured'
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'http'
  | 'invalid_response';

/**
 * The one error this package throws. A caller that treats a completion as
 * best-effort catches it and moves on; a caller that needs to tell a rate limit
 * from a timeout reads `code` and `status`.
 */
export class LlmError extends Error {
  override readonly name = 'LlmError';

  constructor(
    readonly code: LlmErrorCode,
    readonly provider: LlmProviderId | LlmProviderSetting,
    message: string,
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}
