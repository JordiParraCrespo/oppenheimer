import { Alert, AlertDescription, AlertTitle } from '@oppenheimer/design-system-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * What the pane says while the relay reports the session's host offline: the
 * terminal is waiting on a machine, not broken, it comes back on its own, and
 * what to run on that machine if the runner is what stopped. `install` is the
 * command because it both writes the service unit and starts it, so it is
 * right whether the service died, was never started after a reboot, or was
 * removed. The title names the host once the list has said which one it is.
 */
export function HostOfflineNotice({ hostName }: { hostName: string | undefined }) {
  const { t } = useTranslation();
  return (
    <Alert tone="warning" data-testid="host-offline-notice">
      {hostName ? (
        <AlertTitle>{t('sessions.session.offline.title', { host: hostName })}</AlertTitle>
      ) : null}
      <AlertDescription className="grid gap-1.5">
        <p>{t('sessions.session.offline.description')}</p>
        {
          // oppenheimer:begin runner
          <p>
            {t('sessions.session.offline.install')}{' '}
            <code className="font-mono text-xs text-fg">oppenheimer-runner install</code>
            {', '}
            {t('sessions.session.offline.status')}{' '}
            <code className="font-mono text-xs text-fg">oppenheimer-runner status</code>
          </p>
          // oppenheimer:end runner
        }
        <p>
          <Link to="/settings/hosts">{t('sessions.session.offline.hosts')}</Link>
        </p>
      </AlertDescription>
    </Alert>
  );
}
