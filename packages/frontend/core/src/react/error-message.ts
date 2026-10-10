import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createErrorMessageResolver, type ResolvedErrorMessage } from '../modules/core';

export type { ResolvedErrorMessage };

type KeyLookup = {
  exists: (key: string) => boolean;
  t: (key: string) => string;
};

/**
 * The i18next instance, when there is one to ask. Without one react-i18next
 * hands back `{}`, and the per-code lookup answers nothing, so the resolver
 * falls back to its generic message rather than throwing.
 */
function keyLookup(i18n: object): KeyLookup | undefined {
  const candidate = i18n as Partial<KeyLookup>;
  if (typeof candidate.exists !== 'function' || typeof candidate.t !== 'function') return undefined;
  return candidate as KeyLookup;
}

/** Resolve repository and mutation failures into the active locale. */
export function useErrorMessage(): (error: unknown, fallback?: string) => ResolvedErrorMessage {
  const { t, i18n } = useTranslation();

  return useCallback(
    (error: unknown, fallback?: string) =>
      createErrorMessageResolver({
        t,
        translateCode: (code) => {
          const lookup = keyLookup(i18n);
          if (!lookup) return undefined;
          const key = `errors.byCode.${code}`;
          return lookup.exists(key) ? lookup.t(key) : undefined;
        },
      })(error, fallback),
    [t, i18n],
  );
}
