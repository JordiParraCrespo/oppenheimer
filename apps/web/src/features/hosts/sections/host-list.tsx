import { Skeleton } from '@oppenheimer/design-system-web';
import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { HostsEmpty } from '../components/hosts-empty';
import { HostRow } from './host-row';

/**
 * The hosts, one card each. The list is `GET /v1/hosts`, which leaves removed
 * hosts out, so a host that is removed here leaves the list with the refetch.
 * It subscribes because it draws the rows; a row gets its host by reference,
 * kept across a poll that did not change it (`shareEntities`).
 *
 * The frame draws the list and its empty card only; until the first answer a
 * skeleton holds the card's place, and a failed load stays on screen as an
 * `Alert` that says why.
 */
export function HostList() {
  const { t } = useTranslation();
  const hosts = useHosts({ refetchInterval: 15_000 });

  return (
    <QueryState
      query={hosts}
      pending={<Skeleton className="h-18 w-full" />}
      errorFallback={t('settings.hosts.failed')}
      isEmpty={(rows) => rows.length === 0}
      empty={<HostsEmpty title={t('settings.hosts.empty')} body={t('settings.hosts.emptyHint')} />}
    >
      {(rows) => (
        <div className="flex flex-col gap-2.5">
          {rows.map((host) => (
            <HostRow key={host.id} host={host} />
          ))}
        </div>
      )}
    </QueryState>
  );
}
