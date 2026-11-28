import { SidebarSearchField } from '@oppenheimer/frontend-web';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionBots } from './section-bots';

/**
 * A section's Bots heading with Search bots at the top of its rows (the
 * sessions sidebar's). It owns the settled search, which is not kept, and a
 * fold leaves it as it was.
 */
export function SearchableSectionBots({ section }: { section: BotSection }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  return (
    <SectionBots
      section={section}
      query={query}
      search={
        <SidebarSearchField
          value={query}
          onChange={setQuery}
          label={t('bots.sidebar.search')}
          clearLabel={t('bots.sidebar.clearSearch')}
        />
      }
    />
  );
}
