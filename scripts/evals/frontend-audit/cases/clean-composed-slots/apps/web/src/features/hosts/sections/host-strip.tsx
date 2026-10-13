import { Skeleton } from '@oppenheimer/design-system-web';
import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { type DataOf, QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { HostChip } from '../components/host-chip';
import { HostLine } from '../components/host-line';
import { HostsByPresence } from '../components/hosts-by-presence';
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
      <QueryState.Data>
        {(rows: DataOf<typeof hosts>) => (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <HostsByPresence hosts={rows}>
                {(host) => <HostChip key={host.id} host={host} />}
              </HostsByPresence>
            </div>
            <div className="flex flex-col divide-y divide-border-subtle">
              <HostsByPresence hosts={rows}>
                {(host) => (
                  <HostLine key={host.id} host={host}>
                    {host.runnerVersion ? (
                      <span className="text-sm text-fg-muted">
                        {t('hosts.settings.meta.runner', { version: host.runnerVersion })}
                      </span>
                    ) : null}
                    <span className="figures text-sm text-fg-muted">
                      {host.details.runningSessionCount}
                    </span>
                  </HostLine>
                )}
              </HostsByPresence>
            </div>
          </div>
        )}
      </QueryState.Data>
    </QueryState>
  );
}
