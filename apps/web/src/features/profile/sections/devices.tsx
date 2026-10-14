import { SettingsHeading, Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { DeviceRows } from './device-rows';

/**
 * Devices: every browser signed in to the account. The list is a "do you
 * recognise this?" prompt, so a device reads as platform and browser, and
 * when it was last active. The rows read it under Suspense.
 */
export function DevicesSection() {
  const { t } = useTranslation();

  return (
    <section className="flex flex-col gap-3">
      <SettingsHeading>{t('settings.devices.heading')}</SettingsHeading>
      <QueryState>
        <QueryState.Pending>
          <Skeleton className="h-16 w-full" />
        </QueryState.Pending>
        <QueryState.Error fallback={t('settings.devices.failed')} />
        <QueryState.Data>
          <DeviceRows />
        </QueryState.Data>
      </QueryState>
    </section>
  );
}
