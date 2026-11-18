import { EmptyState, SettingsGroup, SettingsListRow } from '@oppenheimer/design-system-web';
import { Server } from '@oppenheimer/design-system-web/icons';
import { useSuspenseHosts } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Every host in a settings card, a row each: the name over its summary. */
export function HostInventory() {
  const { t } = useTranslation();
  const { data: hosts, error } = useSuspenseHosts();
  if (hosts.length === 0)
    return (
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <Server />
          </EmptyState.Media>
          <EmptyState.Title>{t('settings.hosts.empty')}</EmptyState.Title>
          <EmptyState.Description>{t('settings.hosts.emptyHint')}</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    );
  return (
    <>
      <ErrorAlert error={error} fallback={t('settings.hosts.failed')} />
      <SettingsGroup>
        {hosts.map((host) => (
          <SettingsListRow key={host.id} meta={host.summary}>
            {host.name}
          </SettingsListRow>
        ))}
      </SettingsGroup>
    </>
  );
}
