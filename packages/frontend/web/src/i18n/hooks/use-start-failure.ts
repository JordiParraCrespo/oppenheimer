import { useTranslation } from 'react-i18next';
import { type FailureReason, failureReason } from '../lib/start-failure';

/**
 * Why a session's start failed, as the session's page and the Inbox both say
 * it: the code's sentence in the reader's language (`fallback` when the code
 * has none), and the host's raw detail for a line of its own.
 */
export function useStartFailure(
  failure: { code: string | null; detail: string | null } | null | undefined,
  fallback: string,
): FailureReason | null {
  const { t, i18n } = useTranslation();
  return failureReason(
    failure,
    t,
    (code) => {
      const key = `errors.byCode.${code}`;
      return i18n.exists(key) ? (i18n.t(key as never) as string) : undefined;
    },
    fallback,
  );
}
