import { Skeleton } from '@oppenheimer/design-system-web';
import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
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

  if (hosts.isPending) return <Skeleton className="h-18 w-full" />;
  if (hosts.isError) {
    return <ErrorAlert error={hosts.error} fallback={t('settings.hosts.failed')} />;
  }
  if (hosts.data.length === 0) {
    return <HostsEmpty title={t('settings.hosts.empty')} body={t('settings.hosts.emptyHint')} />;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {hosts.data.map((host) => (
        <HostRow key={host.id} host={host} />
      ))}
    </div>
  );
}
