import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { Compass } from '@oppenheimer/design-system-web/icons';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScreenFailure } from './screen-failure';

/**
 * What a route renders when there is nothing to render.
 *
 * Both are route *components*, not screens: a router hands them to
 * `errorComponent` and `notFoundComponent`, and every app needs the same two.
 * Mounted on a layout route they keep that layout — the console's 404 keeps
 * its sidebar, so a mistyped session id leaves the reader inside the product
 * with their sessions still one click away, rather than on a bare page.
 */
export function RouteNotFound({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();

  return (
    <EmptyState className="my-auto">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <Compass />
        </EmptyState.Media>
        <EmptyState.Title>{t('errors.notFound.title')}</EmptyState.Title>
        <EmptyState.Description>{t('errors.notFound.description')}</EmptyState.Description>
      </EmptyState.Header>
      <EmptyState.Content>{children}</EmptyState.Content>
    </EmptyState>
  );
}

/**
 * A thrown render error, with the one action that has ever fixed one: try
 * again. `router.invalidate()` re-runs the failed match rather than reloading
 * the document, so a failure that was the network's costs a retry and not the
 * whole app's state.
 *
 * `error` is `unknown`, which is what a route's `errorComponent` is handed, and
 * what makes this assignable to it without a cast.
 *
 * The message shown is never the error's own: what a bundler throws is not a
 * sentence anyone can act on. A failure from a request — one carrying the
 * status the server answered, or the code a repository names it by — is
 * resolved like any other, so an answered failure reads by its code and an
 * unanswered one as "could not reach the server"; its code and correlation id
 * are shown so a bug report can quote them. A plain render throw carries
 * neither and gets the fallback sentence: the resolver would otherwise read
 * its missing status as the connection's fault.
 */
export function RouteError({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const router = useRouter();
  const resolveError = useErrorMessage();
  const resolved = isRequestFailure(error) ? resolveError(error) : undefined;

  return (
    <ScreenFailure
      title={t('errors.unexpected.title')}
      description={resolved?.message ?? t('errors.fallback')}
      detail={
        resolved?.code || resolved?.correlationId
          ? [
              resolved.code ? t('errors.code', { code: resolved.code }) : null,
              resolved.correlationId
                ? t('errors.correlationId', { id: resolved.correlationId })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : null
      }
      action={
        <Button variant="secondary" onClick={() => router.invalidate()}>
          {t('errors.unexpected.retry')}
        </Button>
      }
    >
      {/* Not shown, but in the DOM for a bug report to carry. */}
      <p hidden data-slot="route-error-message">
        {describeThrow(error)}
      </p>
    </ScreenFailure>
  );
}

function isRequestFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { status, code } = error as { status?: unknown; code?: unknown };
  return typeof status === 'number' || (typeof code === 'string' && code !== '');
}

/** The throw as text for a bug report: a message, or the object itself — never `[object Object]`. */
function describeThrow(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error !== 'object' || error === null) return String(error);
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
