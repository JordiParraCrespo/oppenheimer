import { SidebarSearch } from '@oppenheimer/design-system-web';
import { useSearchDraft } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The sidebar's search box. It owns the half-typed word and hands the list the
 * settled one, once per burst of typing (the kit's `useSearchDraft`): a live
 * value held by the sidebar re-rendered every group and row on each keystroke.
 */
export function SessionsSearch({ onChange }: { onChange: (query: string) => void }) {
  const { t } = useTranslation();
  const { draft, type } = useSearchDraft({ onChange });

  return (
    <SidebarSearch
      value={draft}
      onValueChange={type}
      placeholder={t('sessions.sidebar.search')}
      aria-label={t('sessions.sidebar.search')}
      clearLabel={t('sessions.sidebar.clearSearch')}
    />
  );
}
