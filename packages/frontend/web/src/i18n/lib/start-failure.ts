import type { TFunction } from 'i18next';

/**
 * Runner codes that read differently in the console than in the shared
 * catalog: said in the console's words, for what a person can do about them.
 */
const KNOWN_FAILURE_CODES = ['SESS_002'] as const;

type KnownFailureCode = (typeof KNOWN_FAILURE_CODES)[number];

function isKnownFailureCode(code: string): code is KnownFailureCode {
  return (KNOWN_FAILURE_CODES as readonly string[]).includes(code);
}

/** Why a session's start failed, in the reader's language, and the host's own words beside it. */
export interface FailureReason {
  /** Translated: the code's meaning, or the caller's fallback when it has none. */
  reason: string;
  /** The host's raw detail, English, for a secondary "details" line only. */
  detail: string | null;
}

/**
 * Why a start failed. The host's `detail` is English written for an operator,
 * so it is never the reason itself: the code picks the sentence — the
 * console's own copy first, then the shared `errors.byCode` catalog through
 * `translateCode` — and a code neither knows reads as the caller's
 * `fallback`. The detail rides along for a secondary line.
 */
export function failureReason(
  failure: { code: string | null; detail: string | null } | null | undefined,
  t: TFunction,
  translateCode: (code: string) => string | undefined,
  fallback: string,
): FailureReason | null {
  if (!failure) return null;
  const { code, detail } = failure;
  const reason =
    code && isKnownFailureCode(code)
      ? t(`sessions.provisioning.codes.${code}`)
      : ((code ? translateCode(code) : undefined) ?? fallback);
  return { reason, detail };
}
