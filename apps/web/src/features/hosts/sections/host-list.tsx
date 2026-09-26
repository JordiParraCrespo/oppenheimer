import { Alert, AlertDescription, EmptyState, Skeleton } from '@oppenheimer/design-system-web';
import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { HostRow } from './host-row';

/**
 * The hosts, one card each. The list is `GET /v1/hosts`, which leaves removed
 * hosts out, so a host that is removed here leaves the list with the refetch.
 * It subscribes because it draws the rows; a row gets its host by reference,
 * kept across a poll that did not change it (`shareEntities`).
 */
export function HostList() {
  const { t } = useTranslation();
  const hosts = useHosts({ refetchInterval: 15_000 });

  if (hosts.isPending) {
    return (
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-19 rounded-lg" />
        <Skeleton className="h-19 rounded-lg" />
      </div>
    );
  }
  if (hosts.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('hosts.settings.loadFailed')}</AlertDescription>
      </Alert>
    );
  }
  if (hosts.data.length === 0) {
    return (
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Title>{t('hosts.settings.emptyTitle')}</EmptyState.Title>
          <EmptyState.Description>{t('hosts.settings.emptyBody')}</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {hosts.data.map((host) => (
        <HostRow key={host.id} host={host} />
      ))}
    </div>
  );
}
