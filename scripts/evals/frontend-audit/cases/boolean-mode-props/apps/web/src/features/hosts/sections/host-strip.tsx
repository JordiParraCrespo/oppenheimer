import { Skeleton } from '@oppenheimer/design-system-web';
import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { HostSummary } from '../components/host-summary';
import { HostsEmpty } from '../components/hosts-empty';

/** The hosts as a strip of chips over the full list, each row with its runner and sessions. */
export function HostStrip() {
  const { t } = useTranslation();
  const hosts = useHosts();

  return (
    <QueryState query={hosts} isEmpty={(rows) => rows.length === 0}>
      <QueryState.Pending>
        <Skeleton className="h-18 w-full" />
      </QueryState.Pending>
      <QueryState.Error fallback={t('settings.hosts.failed')} />
      <QueryState.Empty>
        <HostsEmpty title={t('settings.hosts.empty')} body={t('settings.hosts.emptyHint')} />
      </QueryState.Empty>
      <QueryState.Data of={hosts}>
        {(rows) => (
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
      </QueryState.Data>
    </QueryState>
  );
}
