import { SidebarSearch } from '@oppenheimer/design-system-web';
import { useSearchDraft } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The automations sidebar's search box. It owns the half-typed word and hands
 * the list the settled one, once per burst of typing (the kit's
 * `useSearchDraft`); Escape clears it the same way.
 */
export function AutomationsSearch({ onChange }: { onChange: (query: string) => void }) {
  const { t } = useTranslation();
  const { draft, type } = useSearchDraft({ onChange });

  return (
    <SidebarSearch
      value={draft}
      onValueChange={type}
      onKeyDown={(event) => {
        if (event.key === 'Escape') type('');
      }}
      aria-label={t('automations.sidebar.search')}
      placeholder={t('automations.sidebar.search')}
      clearLabel={t('automations.sidebar.clearSearch')}
    />
  );
}
