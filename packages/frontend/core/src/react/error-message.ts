import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createErrorMessageResolver, type ResolvedErrorMessage } from '../modules/core';

export type { ResolvedErrorMessage };

/** Resolve repository and mutation failures into the active locale. */
export function useErrorMessage(): (error: unknown, fallback?: string) => ResolvedErrorMessage {
  const { t, i18n } = useTranslation();

  return useCallback(
    (error: unknown, fallback?: string) =>
      createErrorMessageResolver({
        t,
        translateCode: (code) => {
          const key = `errors.byCode.${code}`;
          return i18n.exists(key) ? (i18n.t(key as never) as string) : undefined;
        },
      })(error, fallback),
    [t, i18n],
  );
}
