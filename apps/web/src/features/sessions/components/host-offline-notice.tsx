import { Alert, AlertDescription, AlertTitle } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The commands a reader runs on the machine; the installer links the binary
 * under this name. Optional so the notice still reads without them.
 */
const RUNNER_COMMANDS: { restart?: string; status?: string } = {
  // oppenheimer:begin runner
  restart: 'oppenheimer-runner install',
  status: 'oppenheimer-runner status',
  // oppenheimer:end runner
};

/**
 * What the pane says while the relay reports the session's host offline: the
 * terminal is waiting on a machine, not broken, it comes back on its own, and
 * what to run on that machine if the runner is what stopped. `install` is the
 * one command that both writes the unit and (re)starts it, so it is right
 * whether the service died, was never started after a reboot, or was removed.
 *
 * `hostsLink` is the way to Settings → Hosts, rendered by the caller: a
 * component draws, it does not route.
 */
export function HostOfflineNotice({
  hostName,
  hostsLink,
}: {
  hostName: string | undefined;
  hostsLink: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Alert tone="warning" data-testid="host-offline-notice">
      <AlertTitle>
        {hostName
          ? t('sessions.session.offline.title', { host: hostName })
          : t('sessions.session.offline.titleUnnamed')}
      </AlertTitle>
      <AlertDescription className="grid gap-1.5">
        <p>{t('sessions.session.offline.description')}</p>
        {RUNNER_COMMANDS.restart && RUNNER_COMMANDS.status ? (
          <p>
            {t('sessions.session.offline.restart')}{' '}
            <code className="font-mono text-[12.5px] text-fg">{RUNNER_COMMANDS.restart}</code>
            {', '}
            {t('sessions.session.offline.status')}{' '}
            <code className="font-mono text-[12.5px] text-fg">{RUNNER_COMMANDS.status}</code>
          </p>
        ) : null}
        <p>{hostsLink}</p>
      </AlertDescription>
    </Alert>
  );
}
