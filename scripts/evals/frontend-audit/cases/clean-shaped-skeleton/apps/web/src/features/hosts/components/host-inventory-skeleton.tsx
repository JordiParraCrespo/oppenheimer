import { SettingsGroup, SettingsListRow, Skeleton } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * The inventory before the hosts answer: the same settings card, three rows
 * at a row's height, a bar for the name and one for the summary under it.
 */
export function HostInventorySkeleton() {
  const { t } = useTranslation();
  return (
    <SettingsGroup aria-busy>
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
      {['w-36', 'w-28', 'w-40'].map((width) => (
        <SettingsListRow
          key={width}
          aria-hidden
          meta={<Skeleton shape="sm" className="my-0.5 h-2.5 w-48" />}
        >
          <span className="flex h-5 items-center">
            <Skeleton shape="sm" className={`h-3 ${width}`} />
          </span>
        </SettingsListRow>
      ))}
    </SettingsGroup>
  );
}
