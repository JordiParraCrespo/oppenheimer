import { Button } from '@oppenheimer/design-system-web';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { ErrorAlert } from '../../forms';

/**
 * Where a Suspense read's first failure lands: the reads below it suspend
 * under a `<Suspense>` of their own and throw here when they fail, and this
 * draws the failure as `ErrorAlert` in their place, with Try again.
 *
 * ```tsx
 * <QueryErrorBoundary fallback={t('settings.hosts.failed')}>
 *   <Suspense fallback={<Skeleton className="h-18 w-full" />}>
 *     <HostListRows />   // useSuspenseHostPresence(): `data` is the hosts
 *   </Suspense>
 * </QueryErrorBoundary>
 * ```
 *
 * TanStack's recipe (its Suspense guide): `react-error-boundary`'s
 * `ErrorBoundary` inside `QueryErrorResetBoundary`, whose `reset` runs on Try
 * again before the children draw again, so they fetch rather than rethrow the
 * error they cached. Only a first failure lands here: a refetch that fails
 * over data already drawn is `error` on the read, for the section to show
 * beside it.
 */
export function QueryErrorBoundary({
  fallback,
  className,
  children,
}: {
  /** Already translated: the failure's sentence when its code has none. */
  fallback: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <BoundaryFailure
              error={error}
              fallback={fallback}
              className={className}
              onRetry={resetErrorBoundary}
            />
          )}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

function BoundaryFailure({
  error,
  fallback,
  className,
  onRetry,
}: {
  error: unknown;
  fallback: string;
  className?: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ErrorAlert
      error={error}
      fallback={fallback}
      className={className}
      action={
        <Button variant="ghost" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      }
    />
  );
}
