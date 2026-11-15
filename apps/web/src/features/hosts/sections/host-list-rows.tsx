import { EmptyState } from '@oppenheimer/design-system-web';
import { Server } from '@oppenheimer/design-system-web/icons';
import { useSuspenseHostPresence } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { HostRow } from './host-row';

/**
 * The host cards, in `HostList`'s `QueryState.Data`. The list is
 * `GET /v1/hosts`, which leaves removed hosts out, so a host removed here
 * leaves the list with the refetch. It subscribes because it draws the rows, and each card shows
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
        <EmptyState className="rounded-lg border border-border-subtle bg-card py-10">
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <Server />
            </EmptyState.Media>
            <EmptyState.Title>{t('settings.hosts.empty')}</EmptyState.Title>
            <EmptyState.Description>{t('settings.hosts.emptyHint')}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      ) : (
        hosts.map((host) => <HostRow key={host.id} host={host} />)
      )}
    </div>
  );
}
