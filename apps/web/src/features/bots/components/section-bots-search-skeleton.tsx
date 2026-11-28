import { SidebarSearch } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * `SearchableSectionBots`' Search bots before its code has arrived: the same
 * field, read-only, so the rows under it do not move when the real one lands.
 */
export function SectionBotsSearchSkeleton() {
  const { t } = useTranslation();
  return (
    <SidebarSearch
      value=""
      onValueChange={() => {}}
      readOnly
      placeholder={t('bots.sidebar.search')}
      aria-label={t('bots.sidebar.search')}
    />
  );
}
