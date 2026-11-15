import { Button } from '@oppenheimer/design-system-web';
import { RotateCcw, SquareTerminal } from '@oppenheimer/design-system-web/icons';
import { useRetrySession } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * Try again, under a start that failed: the host is sent the same start, with
 * the same task, once whatever stopped it (a sign-in, a missing tool) is fixed
 * there. The answer is the row `starting` again, so the pane above it turns
 * back into the steps in place; a refusal stays here, under the button.
 *
 * Beside it, while the host is online, a blank terminal in its home (the host
 * row's **Open terminal**), where that fix is made: `claude auth login`, an
 * install. It opens as a session of its own, so this one is a back away.
 */
export function SessionRetryStart({
  sessionId,
  host,
}: {
  sessionId: string;
  host: { id: string; name: string } | null;
}) {
  const { t } = useTranslation();
  const retry = useRetrySession();

  return (
    <div className="mt-6.5 flex flex-col items-start gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => retry.mutate(sessionId)}
          pending={retry.isPending}
          pendingLabel={t('sessions.provisioning.retrying')}
        >
          <RotateCcw />
          {t('sessions.provisioning.retry')}
        </Button>
        {host ? (
          <Button
            variant="secondary"
            title={t('sessions.provisioning.openTerminalTitle', { host: host.name })}
            render={
              <Link
                to="/sessions/new"
                search={{ where: 'folder', host: host.id, path: '~', agent: 'shell', start: true }}
              />
            }
          >
            <SquareTerminal />
            {t('sessions.provisioning.openTerminal', { host: host.name })}
          </Button>
        ) : null}
      </div>
      <ErrorAlert error={retry.error} fallback={t('sessions.provisioning.retryFailed')} />
    </div>
  );
}
