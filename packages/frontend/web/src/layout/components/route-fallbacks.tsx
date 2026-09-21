import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { CircleAlert, Compass } from '@oppenheimer/design-system-web/icons';
import { useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

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
 * `error` is `unknown`, which is what a route's `errorComponent` is handed and
 * what a `throw` is worth: anything at all can be thrown, and a component that
 * declares `Error` is one `throw 'nope'` away from reading `.message` off a
 * string. Typing it honestly is also what makes this assignable to
 * `errorComponent` without a cast.
 *
 * The message shown is the fallback sentence, never the error's own: what a
 * bundler throws is not a sentence anyone can act on, and a server's own
 * explanation reaches the reader through the screen that asked, not here.
 */
export function RouteError({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <EmptyState className="my-auto">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <CircleAlert />
        </EmptyState.Media>
        <EmptyState.Title>{t('errors.unexpected.title')}</EmptyState.Title>
        <EmptyState.Description>{t('errors.fallback')}</EmptyState.Description>
      </EmptyState.Header>
      <EmptyState.Content>
        <Button variant="secondary" onClick={() => router.invalidate()}>
          {t('errors.unexpected.retry')}
        </Button>
      </EmptyState.Content>
      {/* Not shown, but in the DOM for a bug report to carry. */}
      <p hidden data-slot="route-error-message">
        {error instanceof Error ? error.message : String(error)}
      </p>
    </EmptyState>
  );
}
