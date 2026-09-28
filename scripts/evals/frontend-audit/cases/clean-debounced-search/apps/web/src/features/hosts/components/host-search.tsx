import { SidebarSearchField } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** The search over the host list. The kit's field keeps what is being typed and reports it once typing settles. */
export function HostSearch({ onChange }: { onChange: (query: string) => void }) {
  const { t } = useTranslation();

  return (
    <SidebarSearchField
      onChange={onChange}
      label={t('common.search')}
      clearLabel={t('common.clearSearch')}
    />
  );
}
