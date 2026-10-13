import { useSuspenseHostPresence } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { HostsEmpty } from '../components/hosts-empty';
import { HostRow } from './host-row';

/**
 * The host cards, under `HostList`'s boundaries. The list is `GET /v1/hosts`,
 * which leaves removed hosts out, so a host removed here leaves the list with
 * the refetch. It subscribes because it draws the rows, and each card shows
 * whether its host is online, which this read polls to keep current; a row
 * gets its host by reference, kept across a poll that changed nothing
 * (`shareEntities`).
 *
 * A poll that fails over cards already drawn keeps them and says so above
 * them: those cards are still the hosts the reader was looking at.
 */
export function HostListRows() {
  const { t } = useTranslation();
  const { data: hosts, error } = useSuspenseHostPresence();

  return (
    <div className="flex flex-col gap-2.5">
      <ErrorAlert error={error} fallback={t('settings.hosts.failed')} />
      {hosts.length === 0 ? (
        <HostsEmpty title={t('settings.hosts.empty')} body={t('settings.hosts.emptyHint')} />
      ) : (
        hosts.map((host) => <HostRow key={host.id} host={host} />)
      )}
    </div>
  );
}
