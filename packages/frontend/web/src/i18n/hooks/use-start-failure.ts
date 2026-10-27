import { useTranslation } from 'react-i18next';
import { type FailureReason, failureReason } from '../lib/start-failure';

/**
 * Why a session's start failed, as the session's page and the Inbox both say
 * it: the code's sentence in the reader's language (`fallback` when the code
 * has none), and the host's raw detail for a line of its own. A code reads in
 * the console's words first (`errors.startFailure.codes`, for the few a person
 * can act on), then in the shared `errors.byCode` catalog.
 */
export function useStartFailure(
  failure: { code: string | null; detail: string | null } | null | undefined,
  fallback: string,
): FailureReason | null {
  const { i18n } = useTranslation();
  return failureReason(
    failure,
    (code) => {
      const key = [`errors.startFailure.codes.${code}`, `errors.byCode.${code}`].find((candidate) =>
        i18n.exists(candidate),
      );
      return key ? (i18n.t(key as never) as string) : undefined;
    },
    fallback,
  );
}
