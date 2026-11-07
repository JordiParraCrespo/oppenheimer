import { Button } from '@oppenheimer/design-system-web';
import { RotateCcw } from '@oppenheimer/design-system-web/icons';
import { useRetrySession } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Try again, under a start that failed: the host is sent the same start, with
 * the same task, once whatever stopped it (a sign-in, a missing tool) is fixed
 * there. The answer is the row `starting` again, so the pane above it turns
 * back into the steps in place; a refusal stays here, under the button.
 */
export function SessionRetryStart({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const retry = useRetrySession();

  return (
    <div className="mt-6.5 flex flex-col items-start gap-4">
      <Button
        onClick={() => retry.mutate(sessionId)}
        pending={retry.isPending}
        pendingLabel={t('sessions.provisioning.retrying')}
      >
        <RotateCcw />
        {t('sessions.provisioning.retry')}
      </Button>
      <ErrorAlert error={retry.error} fallback={t('sessions.provisioning.retryFailed')} />
    </div>
  );
}
