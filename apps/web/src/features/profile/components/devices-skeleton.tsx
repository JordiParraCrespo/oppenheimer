import { Badge, SettingsGroup, SettingsRow, Skeleton } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * The devices before they answer: the settings card with this device first,
 * marked as it will be (the signed-in browser is always in the list), and one
 * other under it with its Sign out, a bar for each device's name and last
 * activity at the rows' line heights.
 */
export function DevicesSkeleton() {
  const { t } = useTranslation();
  return (
    <SettingsGroup aria-busy>
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
      <SettingsRow
        aria-hidden
        label={
          <span className="flex h-5 items-center">
            <Skeleton shape="sm" className="h-3 w-36" />
          </span>
        }
        hint={
          <span className="flex h-4.75 items-center">
            <Skeleton shape="sm" className="h-2.5 w-20" />
          </span>
        }
      >
        <Badge variant="neutral">{t('settings.devices.current')}</Badge>
      </SettingsRow>
      <SettingsRow
        aria-hidden
        label={
          <span className="flex h-5 items-center">
            <Skeleton shape="sm" className="h-3 w-44" />
          </span>
        }
        hint={
          <span className="flex h-4.75 items-center">
            <Skeleton shape="sm" className="h-2.5 w-28" />
          </span>
        }
      >
        <span className="flex h-(--control-h-sm) items-center px-(--control-pad-sm)">
          <Skeleton shape="sm" className="h-2.5 w-14" />
        </span>
      </SettingsRow>
    </SettingsGroup>
  );
}
