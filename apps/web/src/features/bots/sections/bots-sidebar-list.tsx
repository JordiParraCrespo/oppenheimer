import { SidebarEmptyRow } from '@oppenheimer/design-system-web';
import { useSuspenseBotsAndGroups } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, SidebarSearchField } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { botSections } from '@/features/bots/lib/bot-groups';
import { BotGroup } from './bot-group';
import { BotsEmptyCard } from './bots-empty-card';
import { NewGroup } from './new-group';

/** The key a folded section is remembered by; Ungrouped has no id of its own. */
const UNGROUPED = 'ungrouped';

/**
 * The Employees sidebar under its brand row (`design/version1/Bots.dc.html`):
 * Search bots, then the groups in their order and Ungrouped after them, then
 * New group. It reads the bots and the groups under Suspense, side by side,
 * and holds what the sections share: the settled search and which are
 * folded. The half-typed search lives in the field and each section's clock
 * in the section, so a keystroke or a tick does not redraw the rows. Before
 * the first bot the list opens on the design's empty card. A refetch that
 * fails keeps the sections and says so above them.
 */
export function BotsSidebarList() {
  const { t } = useTranslation();
  const { bots, groups, error } = useSuspenseBotsAndGroups();
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<string[]>([]);
  const term = query.trim();
  const sections = botSections(bots, groups, term);

  return (
    <>
      <SidebarSearchField
        onChange={setQuery}
        label={t('bots.sidebar.search')}
        clearLabel={t('bots.sidebar.clearSearch')}
      />
      <ErrorAlert error={error} fallback={t('bots.sidebar.loadFailed')} className="mx-3 mb-2" />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-5">
        {bots.length === 0 ? <BotsEmptyCard /> : null}
        {term && sections.length === 0 && bots.length > 0 ? (
          <SidebarEmptyRow className="mt-2 ml-3.5">
            {t('bots.sidebar.noMatch', { query: term })}
          </SidebarEmptyRow>
        ) : null}
        {sections.map((section) => {
          const key = section.id ?? UNGROUPED;
          return (
            <BotGroup
              key={key}
              section={section}
              groups={groups}
              open={Boolean(term) || !closed.includes(key)}
              onOpenChange={(next) =>
                setClosed((current) =>
                  next ? current.filter((id) => id !== key) : [...current, key],
                )
              }
              searching={Boolean(term)}
            />
          );
        })}
        <NewGroup />
      </div>
    </>
  );
}
