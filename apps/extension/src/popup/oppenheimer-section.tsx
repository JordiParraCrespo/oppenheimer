import {
  Button,
  Callout,
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Input,
  SidebarListHead,
  StatusDot,
} from '@oppenheimer/design-system-web';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OppenheimerConnection, ReportStatus } from '@/sessions/store';
import { useConnection } from './hooks/use-connection';

/**
 * Oppenheimer: where the statuses go. Connected, the worker reports what the
 * cloud sessions are doing after every check, and the console draws the
 * ones its workspace launched. The token is a personal API token from the
 * console's settings, with `sessions:write`. The same connection reads the
 * sessions on the person's hosts that wait on them; the console's URL is
 * where a notification about one opens, worked out from the API's when left
 * empty.
 */
export function OppenheimerSection({
  connection,
  report,
  runnerProblem,
}: {
  connection: OppenheimerConnection | undefined;
  report: ReportStatus | undefined;
  /** Why the sessions on the person's hosts could not be read, while they cannot. */
  runnerProblem: { detail: string } | undefined;
}) {
  const { t } = useTranslation();
  const { connect, disconnect, pending, problem } = useConnection();
  const [apiUrl, setApiUrl] = useState('http://localhost:3001');
  const [token, setToken] = useState('');
  const [consoleUrl, setConsoleUrl] = useState('');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void connect({ apiUrl, token, consoleUrl });
  }

  const host = connection ? new URL(connection.apiUrl).host : '';

  return (
    <section aria-label={t('oppenheimer.label')} className="flex flex-col gap-2">
      <SidebarListHead label={t('oppenheimer.label')} />
      {connection ? (
        <div className="flex items-center gap-2 pl-2.5">
          <StatusDot
            density="compact"
            className="min-w-0 flex-1"
            state={report?.ok === false ? 'failed' : report?.ok ? 'running' : 'pending'}
          >
            {report?.ok === false
              ? t('oppenheimer.notReporting', { detail: report.detail })
              : report?.ok
                ? t('oppenheimer.launched', { host, count: report.matched })
                : t('oppenheimer.reportingTo', { host })}
          </StatusDot>
          <Button size="xs" variant="ghost" onClick={() => void disconnect()}>
            {t('oppenheimer.disconnect')}
          </Button>
        </div>
      ) : null}
      {connection && runnerProblem ? (
        <Callout tone="warning">
          {t('oppenheimer.runnerUnread', { detail: runnerProblem.detail })}
        </Callout>
      ) : null}
      {connection ? null : (
        <div className="px-2.5">
          <Disclosure>
            <DisclosureTrigger tone="muted">{t('oppenheimer.connectTitle')}</DisclosureTrigger>
            <DisclosurePanel className="-mx-2.5 mt-2.5">
              <form className="flex flex-col gap-2" onSubmit={onSubmit}>
                <p className="px-2.5 text-fg-subtle text-xs">{t('oppenheimer.connectHint')}</p>
                <Input
                  size="sm"
                  aria-label={t('oppenheimer.apiUrl')}
                  value={apiUrl}
                  onChange={(event) => setApiUrl(event.target.value)}
                />
                <Input
                  size="sm"
                  aria-label={t('oppenheimer.consoleUrl')}
                  placeholder={t('oppenheimer.consoleUrl')}
                  value={consoleUrl}
                  onChange={(event) => setConsoleUrl(event.target.value)}
                />
                <Input
                  size="sm"
                  type="password"
                  aria-label={t('oppenheimer.token')}
                  placeholder="oppenheimer_pat_…"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                />
                {problem ? <Callout tone="warning">{problem}</Callout> : null}
                <Button size="sm" type="submit" disabled={pending || token.trim() === ''}>
                  {t('oppenheimer.connect')}
                </Button>
              </form>
            </DisclosurePanel>
          </Disclosure>
        </div>
      )}
    </section>
  );
}
