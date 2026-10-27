import { Button, Callout, Input, SidebarListHead } from '@oppenheimer/design-system-web';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OppenheimerConnection, ReportStatus } from '@/sessions/store';
import { useConnection } from './hooks/use-connection';

/**
 * Oppenheimer: where the statuses go. Connected, the worker reports what the
 * cloud sessions are doing after every check, and the console draws the
 * ones its workspace launched. The token is a personal API token from the
 * console's settings, with `sessions:write`.
 */
export function OppenheimerSection({
  connection,
  report,
}: {
  connection: OppenheimerConnection | undefined;
  report: ReportStatus | undefined;
}) {
  const { t } = useTranslation();
  const { connect, disconnect, pending, problem } = useConnection();
  const [apiUrl, setApiUrl] = useState('http://localhost:3001');
  const [token, setToken] = useState('');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void connect({ apiUrl, token });
  }

  return (
    <section aria-label={t('oppenheimer.label')} className="flex flex-col gap-2">
      <SidebarListHead label={t('oppenheimer.label')} />
      {connection ? (
        <div className="flex items-center justify-between gap-2 px-2.5 text-fg-muted text-sm">
          <span className="min-w-0 truncate">
            {report?.ok === false
              ? t('oppenheimer.notReporting', { detail: report.detail })
              : report?.ok
                ? t('oppenheimer.launched', {
                    host: new URL(connection.apiUrl).host,
                    count: report.matched,
                  })
                : t('oppenheimer.reportingTo', { host: new URL(connection.apiUrl).host })}
          </span>
          <Button size="xs" variant="ghost" onClick={() => void disconnect()}>
            {t('oppenheimer.disconnect')}
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-2 px-2.5" onSubmit={onSubmit}>
          <Input
            size="sm"
            aria-label={t('oppenheimer.apiUrl')}
            value={apiUrl}
            onChange={(event) => setApiUrl(event.target.value)}
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
      )}
    </section>
  );
}
