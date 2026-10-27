/** Why a session's start failed, in the reader's language, and the host's own words beside it. */
export interface FailureReason {
  /** Translated: the code's meaning, or the caller's fallback when it has none. */
  reason: string;
  /** The host's raw detail, English, for a secondary "details" line only. */
  detail: string | null;
}

/**
 * Why a start failed. The host's `detail` is English written for an operator,
 * so it is never the reason itself: `translateCode` picks the sentence for the
 * code, and a code it does not know reads as the caller's `fallback`. The
 * detail rides along for a secondary line.
 */
export function failureReason(
  failure: { code: string | null; detail: string | null } | null | undefined,
  translateCode: (code: string) => string | undefined,
  fallback: string,
): FailureReason | null {
  if (!failure) return null;
  const { code, detail } = failure;
  return { reason: (code ? translateCode(code) : undefined) ?? fallback, detail };
}
