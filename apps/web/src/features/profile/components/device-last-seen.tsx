import { useNow } from '@oppenheimer/design-system-web';
import { formatRelativeTime, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * When a device was last active, on a clock of its own: the minute tick
 * redraws this line and not the list around it.
 */
export function DeviceLastSeen({ at }: { at: Date }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const when = formatRelativeTime(at, locale, new Date(now));

  return <>{when ? t('settings.devices.lastSeen', { when }) : t('settings.devices.activeNow')}</>;
}
