import { Button } from '@oppenheimer/design-system-web';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Component, type ReactNode } from 'react';
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
 * Try again resets the queries that failed (`QueryErrorResetBoundary`) before
 * drawing the children again, so they fetch rather than rethrow the error
 * they cached. Only a first failure lands here: a refetch that fails over data
 * already drawn is `error` on the read, for the section to show beside it.
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
        <Boundary
          onReset={reset}
          failure={(error, retry) => (
            <BoundaryFailure
              error={error}
              fallback={fallback}
              className={className}
              onRetry={retry}
            />
          )}
        >
          {children}
        </Boundary>
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

/**
 * React's error boundary, which only a class can be. `failed` is kept beside
 * `error` because a thrown `undefined` is still a failure.
 */
class Boundary extends Component<
  {
    onReset: () => void;
    failure: (error: unknown, retry: () => void) => ReactNode;
    children: ReactNode;
  },
  { failed: boolean; error: unknown }
> {
  state = { failed: false, error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, error };
  }

  retry = () => {
    this.props.onReset();
    this.setState({ failed: false, error: null });
  };

  render() {
    return this.state.failed
      ? this.props.failure(this.state.error, this.retry)
      : this.props.children;
  }
}
