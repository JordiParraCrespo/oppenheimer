import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { HostInventorySkeleton } from '../components/host-inventory-skeleton';
import { HostInventory } from '../sections/host-inventory';

/** Settings → Hosts as an inventory: one row per machine, its name and what it runs. */
export function HostInventoryScreen() {
  const { t } = useTranslation();
  return (
    <>
      <SettingsTitle
        title={t('settings.hosts.title')}
        description={t('settings.hosts.description')}
      />
      <QueryState>
        <QueryState.Pending>
          <HostInventorySkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('settings.hosts.failed')} />
        <QueryState.Data>
          <HostInventory />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
