import {
  DragProvider,
  SidebarEmptyRow,
  SortableGroup,
  sortableProjectId,
} from '@oppenheimer/design-system-web';
import { useSuspenseBotsAndGroups } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, SidebarSearchField, useDragLabels } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotDragOverlay } from '@/features/bots/components/bot-drag-overlay';
import { BotGroupDragOverlay } from '@/features/bots/components/bot-group-drag-overlay';
import { BotsFilterMenu } from '@/features/bots/components/bots-filter-menu';
import { GROUPS, useBotOrder } from '@/features/bots/hooks/use-bot-order';
import { useHiddenBots } from '@/features/bots/hooks/use-hidden-bots';
import { type BotSection, groupOrder, sectionKey } from '@/features/bots/lib/bot-groups';
import { BotGroup } from './bot-group';
import { BotsEmptyCard } from './bots-empty-card';
import { NewGroup } from './new-group';

/**
 * The Employees sidebar under its brand row (`design/version1/Bots.dc.html`):
 * Search bots and its filter menu, then the groups in their order and
 * Ungrouped after them, then New group. It reads the bots and the groups
 * under Suspense, side by side, and holds what the sections share: the
 * settled search, which are folded, and the bots the reader hid
 * (`useHiddenBots`, from a row's menu or the filter menu's Show bots). The half-typed search lives in the field and each section's clock
 * in the section, so a keystroke or a tick does not redraw the rows. Before
 * the first bot the list opens on the design's empty card. A refetch that
 * fails keeps the sections and says so above them.
 *
 * The bots drag into another place in their group or into another group
 * (`useBotOrder`), and the groups by their heads into another order, on the
 * sidebar's own `DragProvider`; not while a search narrows the list, since a
 * drop would lose the places of what it hides. Ungrouped stays last; a drop
 * beside a hidden bot keeps the hidden bot's place.
 */
export function BotsSidebarList() {
  const { t } = useTranslation();
  const { bots, groups, error } = useSuspenseBotsAndGroups();
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<string[]>([]);
  const term = query.trim();
  const { hidden, setShown, showAll } = useHiddenBots();
  const { sections, handlers, botError, groupError, resetBot, resetGroup } = useBotOrder(
    bots,
    groups,
    term,
    hidden,
  );
  const dragLabels = useDragLabels();
  const drawSection = (section: BotSection) => {
    const key = sectionKey(section);
    return (
      <BotGroup
        key={key}
        section={section}
        groups={groups}
        open={Boolean(term) || !closed.includes(key)}
        onOpenChange={(next) =>
          setClosed((current) => (next ? current.filter((id) => id !== key) : [...current, key]))
        }
        searching={Boolean(term)}
        onHide={(id) => setShown(id, false)}
      />
    );
  };

  return (
    <>
      <div className="mr-3 mb-2 flex items-center gap-1">
        <SidebarSearchField
          onChange={setQuery}
          label={t('bots.sidebar.search')}
          clearLabel={t('bots.sidebar.clearSearch')}
          className="mr-0 mb-0 min-w-0 flex-1"
        />
        <BotsFilterMenu bots={bots} hidden={hidden} onShownChange={setShown} onShowAll={showAll} />
      </div>
      <ErrorAlert error={error} fallback={t('bots.sidebar.loadFailed')} className="mx-3 mb-2" />
      <ErrorAlert
        error={botError}
        fallback={t('bots.sidebar.moveFailed')}
        onDismiss={resetBot}
        className="mx-3 mb-2"
      />
      <ErrorAlert
        error={groupError}
        fallback={t('bots.sidebar.groupFailed')}
        onDismiss={resetGroup}
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
          overlay={(active) =>
            active.data.type === 'project' ? (
              <BotGroupDragOverlay name={active.data.label ?? ''} />
            ) : (
              <BotDragOverlay bot={bots.find((candidate) => candidate.id === active.id)} />
            )
          }
        >
          <SortableGroup
            id={GROUPS}
            items={groupOrder(sections).map(sortableProjectId)}
            accepts={['project']}
          >
            {sections.filter((section) => section.group).map(drawSection)}
          </SortableGroup>
          {sections.filter((section) => !section.group).map(drawSection)}
        </DragProvider>
        <NewGroup />
      </div>
    </>
  );
}
