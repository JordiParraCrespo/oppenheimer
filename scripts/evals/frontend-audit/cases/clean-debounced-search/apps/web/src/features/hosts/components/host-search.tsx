import { SearchInput } from '@oppenheimer/design-system-web';
import { useSearchDraft } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** The search over the host list. It keeps what is being typed and reports it once typing settles. */
export function HostSearch({ onChange }: { onChange: (query: string) => void }) {
  const { t } = useTranslation();
  const { draft, type } = useSearchDraft({ onChange });

  return (
    <SearchInput
      value={draft}
      onChange={(event) => type(event.target.value)}
      placeholder={t('common.search')}
    />
  );
}
