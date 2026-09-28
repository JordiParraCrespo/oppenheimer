import { SidebarSearch } from '@oppenheimer/design-system-web';
import { useSearchDraft } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** The search over the host list. It keeps what is being typed and reports it once typing settles. */
export function HostSearch({ onChange }: { onChange: (query: string) => void }) {
  const { t } = useTranslation();
  const { draft, type } = useSearchDraft({ onChange });

  return (
    <SidebarSearch
      value={draft}
      onValueChange={type}
      placeholder={t('common.search')}
      aria-label={t('common.search')}
    />
  );
}
