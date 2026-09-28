import { Button } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { ErrorAlert } from '../../forms';

/**
 * Restoring the session failed (a network or server error), so the app cannot
 * tell whether the reader is signed in. Say so with a retry, rather than
 * mounting the router, which would treat them as signed out and send them to
 * sign in as if they had been logged out.
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
    <div className="flex min-h-svh items-center justify-center bg-canvas p-6">
      <ErrorAlert
        className="max-w-sm"
        title={t('auth.session.errorTitle')}
        message={t('auth.session.errorMessage')}
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            pending={isRetrying}
            pendingLabel={t('auth.session.retrying')}
          >
            {t('auth.session.retry')}
          </Button>
        }
      />
    </div>
  );
}
