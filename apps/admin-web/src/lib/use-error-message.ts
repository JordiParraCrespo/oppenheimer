import { createErrorMessageResolver, type ResolvedErrorMessage } from '@oppenheimer/frontend';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export type { ResolvedErrorMessage };

/**
 * Resolves anything thrown by a repository or mutation into a **translated**
 * failure message, keyed by the API's problem `code`.
 *
 * Use it instead of rendering `error.message`: the server's `detail` is English
 * prose meant for operators and the CLI, so putting it on screen leaks the
 * server's wording into every locale.
 *
 * ```tsx
 * const resolveError = useErrorMessage();
 * {error && <FieldError>{resolveError(error).message}</FieldError>}
 *
 * // …or keeping the screen's own copy for failures with no known code:
 * {resolveError(error, t('auth.login.invalidCredentials')).message}
 * ```
 */
export function useErrorMessage(): (error: unknown, fallback?: string) => ResolvedErrorMessage {
  const { t, i18n } = useTranslation();

  return useCallback(
    (error: unknown, fallback?: string) =>
      createErrorMessageResolver({
        t,
        // `errors.byCode.<CODE>` is built at runtime, so it cannot be checked
        // against the typed catalog. `exists` is what makes the cast safe: an
        // unknown code resolves to `undefined` and the caller's fallback wins,
        // rather than i18next echoing the key back as the message.
        translateCode: (code) => {
          const key = `errors.byCode.${code}`;
          return i18n.exists(key) ? (i18n.t(key as never) as string) : undefined;
        },
      })(error, fallback),
    [t, i18n],
  );
}
