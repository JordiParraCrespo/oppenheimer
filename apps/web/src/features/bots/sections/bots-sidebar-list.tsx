import { DragProvider, SidebarEmptyRow } from '@oppenheimer/design-system-web';
import { useSuspenseBotsAndGroups } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, SidebarSearchField, useDragLabels } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotDragOverlay } from '@/features/bots/components/bot-drag-overlay';
import { useBotOrder } from '@/features/bots/hooks/use-bot-order';
import { sectionKey } from '@/features/bots/lib/bot-groups';
import { BotGroup } from './bot-group';
import { BotsEmptyCard } from './bots-empty-card';
import { NewGroup } from './new-group';

/**
 * The Employees sidebar under its brand row (`design/version1/Bots.dc.html`):
 * Search bots, then the groups in their order and Ungrouped after them, then
 * New group. It reads the bots and the groups under Suspense, side by side,
 * and holds what the sections share: the settled search and which are
 * folded. The half-typed search lives in the field and each section's clock
 * in the section, so a keystroke or a tick does not redraw the rows. Before
 * the first bot the list opens on the design's empty card. A refetch that
 * fails keeps the sections and says so above them.
 *
 * The bots drag into another place in their group or into another group
 * (`useBotOrder`), on the sidebar's own `DragProvider`; not while a search
 * narrows the list, since a drop would lose the places of the bots it hides.
 */
export function BotsSidebarList() {
  const { t } = useTranslation();
  const { bots, groups, error } = useSuspenseBotsAndGroups();
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<string[]>([]);
  const term = query.trim();
  const { sections, handlers, error: moveError, reset } = useBotOrder(bots, groups, term);
  const dragLabels = useDragLabels();

  return (
    <>
      <SidebarSearchField
        onChange={setQuery}
        label={t('bots.sidebar.search')}
        clearLabel={t('bots.sidebar.clearSearch')}
      />
      <ErrorAlert error={error} fallback={t('bots.sidebar.loadFailed')} className="mx-3 mb-2" />
      <ErrorAlert
        error={moveError}
        fallback={t('bots.sidebar.moveFailed')}
        onDismiss={reset}
        className="mx-3 mb-2"
      />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-5">
        {bots.length === 0 ? <BotsEmptyCard /> : null}
        {term && sections.length === 0 && bots.length > 0 ? (
          <SidebarEmptyRow className="mt-2 ml-3.5">
            {t('bots.sidebar.noMatch', { query: term })}
          </SidebarEmptyRow>
        ) : null}
        <DragProvider
          {...handlers}
          labels={dragLabels}
          overlay={(active) => (
            <BotDragOverlay bot={bots.find((candidate) => candidate.id === active.id)} />
          )}
        >
          {sections.map((section) => {
            const key = sectionKey(section);
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
        </DragProvider>
        <NewGroup />
      </div>
    </>
  );
}
