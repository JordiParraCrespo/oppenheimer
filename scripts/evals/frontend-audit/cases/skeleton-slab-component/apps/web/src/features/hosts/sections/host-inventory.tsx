import { SettingsGroup, SettingsListRow } from '@oppenheimer/design-system-web';
import { useSuspenseHosts } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { HostsEmpty } from '../components/hosts-empty';

/** Every host in a settings card, a row each: the name over its summary. */
export function HostInventory() {
  const { t } = useTranslation();
  const { data: hosts, error } = useSuspenseHosts();
  if (hosts.length === 0)
    return <HostsEmpty title={t('settings.hosts.empty')} body={t('settings.hosts.emptyHint')} />;
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
