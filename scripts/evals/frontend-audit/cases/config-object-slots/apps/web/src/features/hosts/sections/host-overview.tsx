import { Button, EmptyState, StatusDot } from '@oppenheimer/design-system-web';
import { Server } from '@oppenheimer/design-system-web/icons';
import { useSuspenseHosts } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HostPanel } from '../components/host-panel';

/** The hosts settings page's overview: every paired host, and the way to add one. */
export function HostOverview() {
  const { t } = useTranslation();
  const { data: rows, error } = useSuspenseHosts();

  return (
    <>
      <ErrorAlert error={error} fallback={t('settings.hosts.failed')} />
      <HostPanel
        title={t('settings.hosts.title')}
        header={{ meta: String(rows.length) }}
        empty={{
          when: rows.length === 0,
          show: (
            <EmptyState>
              <EmptyState.Header>
                <EmptyState.Media variant="icon">
                  <Server />
                </EmptyState.Media>
                <EmptyState.Title>{t('settings.hosts.empty')}</EmptyState.Title>
                <EmptyState.Description>{t('settings.hosts.emptyHint')}</EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          ),
        }}
        renderFooter={() => (
          <Button variant="ghost" size="sm" render={<Link to="/settings/hosts/new" />}>
            {t('settings.hosts.add')}
          </Button>
        )}
      >
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {rows.map((host) => (
            <li key={host.id}>
              <StatusDot state={host.online ? 'running' : 'idle'}>{host.summary}</StatusDot>
            </li>
          ))}
        </ul>
      </HostPanel>
    </>
  );
}
