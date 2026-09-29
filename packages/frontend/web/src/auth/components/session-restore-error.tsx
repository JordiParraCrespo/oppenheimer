import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { CircleAlert } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * Restoring the session failed (a network or server error), so the app cannot
 * tell whether the reader is signed in. Say so with a retry, rather than
 * mounting the router, which would treat them as signed out and send them to
 * sign in as if they had been logged out.
 *
 * The failure is the whole screen, so it is drawn the way the design draws a
 * screen with nothing else on it — `EmptyState`, as `RouteError` is — and not
 * as an `ErrorAlert` card floating on an empty canvas.
 */
export function SessionRestoreError({
  onRetry,
  isRetrying,
}: {
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div role="alert" className="flex min-h-svh flex-col bg-canvas p-6">
      <EmptyState className="my-auto">
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <CircleAlert />
          </EmptyState.Media>
          <EmptyState.Title>{t('auth.session.errorTitle')}</EmptyState.Title>
          <EmptyState.Description>{t('auth.session.errorMessage')}</EmptyState.Description>
        </EmptyState.Header>
        <EmptyState.Content>
          <Button
            variant="secondary"
            onClick={onRetry}
            pending={isRetrying}
            pendingLabel={t('auth.session.retrying')}
          >
            {t('auth.session.retry')}
          </Button>
        </EmptyState.Content>
      </EmptyState>
    </div>
  );
}
