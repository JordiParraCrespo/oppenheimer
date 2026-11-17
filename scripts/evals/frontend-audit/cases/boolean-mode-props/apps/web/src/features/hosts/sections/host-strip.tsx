import { EmptyState } from '@oppenheimer/design-system-web';
import { Server } from '@oppenheimer/design-system-web/icons';
import { useSuspenseHosts } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { HostSummary } from '../components/host-summary';

/** The hosts as a strip of chips over the full list, each row with its runner and sessions. */
export function HostStrip() {
  const { t } = useTranslation();
  const { data: rows, error } = useSuspenseHosts();

  return (
    <>
      <ErrorAlert error={error} fallback={t('settings.hosts.failed')} />
      {rows.length === 0 ? (
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <Server />
            </EmptyState.Media>
            <EmptyState.Title>{t('settings.hosts.empty')}</EmptyState.Title>
            <EmptyState.Description>{t('settings.hosts.emptyHint')}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {rows.map((host) => (
              <HostSummary key={host.id} host={host} compact showStatus />
            ))}
          </div>
          <div className="flex flex-col divide-y divide-border-subtle">
            {rows.map((host) => (
              <HostSummary key={host.id} host={host} showStatus showRunner showSessions />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
