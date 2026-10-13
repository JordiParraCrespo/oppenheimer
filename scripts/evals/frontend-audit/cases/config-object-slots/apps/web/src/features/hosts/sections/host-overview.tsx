import { Button, Skeleton } from '@oppenheimer/design-system-web';
import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HostPanel } from '../components/host-panel';
import { HostsEmpty } from '../components/hosts-empty';

/** The hosts settings page's overview: every paired host, and the way to add one. */
export function HostOverview() {
  const { t } = useTranslation();
  const hosts = useHosts();

  return (
    <QueryState query={hosts}>
      <QueryState.Pending>
        <Skeleton className="h-18 w-full" />
      </QueryState.Pending>
      <QueryState.Error fallback={t('settings.hosts.failed')} />
      <QueryState.Data of={hosts}>
        {(rows) => (
          <HostPanel
            title={t('settings.hosts.title')}
            header={{ meta: String(rows.length) }}
            empty={{
              when: rows.length === 0,
              show: (
                <HostsEmpty
                  title={t('settings.hosts.empty')}
                  body={t('settings.hosts.emptyHint')}
                />
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
                <li key={host.id} className="text-sm text-fg">
                  {host.summary}
                </li>
              ))}
            </ul>
          </HostPanel>
        )}
      </QueryState.Data>
    </QueryState>
  );
}
