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
          // Rendering an error message must never become an error itself: a
          // throw here takes down the whole screen through the error boundary,
          // including whatever the screen offers to get past the failure.
          if (!canLookUpKeys(i18n)) return undefined;
          const key = `errors.byCode.${code}`;
          return i18n.exists(key) ? (i18n.t(key as never) as string) : undefined;
        },
      })(error, fallback),
    [t, i18n],
  );
}

let reportedMissingInstance = false;

/**
 * Without an i18next instance, react-i18next's `useTranslation()` hands back
 * `{}` as `i18n` (and a `t` that echoes keys). That happens when the app never
 * called `initReactI18next`, or when two copies of react-i18next/i18next are
 * installed and this package resolves the one the app did not initialise.
 * The per-code lookup then has nothing to ask, so the resolver falls back to
 * its generic message — and dev builds say why, once.
 */
function canLookUpKeys(i18n: unknown): boolean {
  if (typeof (i18n as { exists?: unknown } | undefined)?.exists === 'function') return true;

  if (!reportedMissingInstance && isDevBuild()) {
    reportedMissingInstance = true;
    console.error(
      '[frontend-core] useErrorMessage: react-i18next returned no i18next instance, so API error ' +
        'codes cannot be translated and every failure shows the generic message. Either the app ' +
        'did not call initReactI18next before rendering, or more than one copy of ' +
        'react-i18next/i18next is installed and @oppenheimer/frontend-core resolved the other one ' +
        '(check `pnpm why react-i18next i18next`).',
    );
  }
  return false;
}

/**
 * Bundlers replace `process.env.NODE_ENV` statically; where nothing did, there
 * is no `process` at all and reading it throws, which only happens outside a
 * production build.
 *
 * Declared here, module-scoped, rather than through `@types/node`: the kernel
 * runs in browsers, and this is the one read of `process` it makes.
 */
declare const process: { readonly env: { readonly NODE_ENV?: string } };

function isDevBuild(): boolean {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return true;
  }
}
