import {
  DragProvider,
  Rail,
  RailItem,
  RailMark,
  SortableGroup,
  SortableRailItem,
  useNow,
} from '@oppenheimer/design-system-web';
import {
  useAnyBotNeedsInput,
  useInboxCount,
  useSessions,
  useTasks,
} from '@oppenheimer/frontend-consumer/react';
import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import { useDragLabels } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConsoleList, useConsoleList } from '@/lib/console';
import { RAIL_GROUP, useRailOrder } from '../hooks/use-rail-order';
import type { RailItemId } from '../lib/rail-landing';
import { railEntry } from '../lib/rail-order';

/**
 * The console's rail, switching the sidebar between its lists. The current
 * one is `useConsoleList`'s answer, the same the shell picks the sidebar by.
 * A section rather than kit because the counts are product reads: the
 * sessions the sidebar already subscribes to, Plan's open tasks, the board's
 * own read, and the Inbox's, what needs you, with the dot while anything
 * does. The Inbox is left out while its flag is off.
 *
 * The reader drags the items into their own order, as the design's rail
 * does; a press still opens the list, and the order is kept on this device
 * (`useRailOrder`). The rail is the console's only drag surface outside a
 * page, so it carries its own `DragProvider`.
 */
export function ConsoleRail() {
  const { t } = useTranslation();
  const { data: sessionCount } = useSessions({ select: (rows) => rows.length });
  const { data: openTasks } = useTasks({
    select: (rows) => rows.filter((row) => !row.isDone).length,
  });
  const botsNeedYou = useAnyBotNeedsInput();
  const list = useConsoleList();
  const dragLabels = useDragLabels();
  const { order, handlers } = useRailOrder();
  const inboxOn = useFeatureFlag('inbox');
  // A minute tick: a snooze that ends brings its item back into the count.
  const needsYou = useInboxCount(useNow(60_000));
  const counts: Partial<Record<RailItemId, ReactNode>> = {
    inbox: needsYou,
    sessions: sessionCount,
    plan: openTasks,
  };
  const attentions: Partial<Record<RailItemId, boolean>> = {
    inbox: Boolean(needsYou),
    bots: botsNeedYou,
  };

  return (
    <Rail aria-label={t('nav.primaryNavigation')}>
      <RailMark label={t('nav.home')} render={<Link to="/" />} />
      <DragProvider
        {...handlers}
        labels={dragLabels}
        overlay={(active) => {
          const entry = railEntry(active.id);
          return entry ? (
            <RailItem label={t(entry.labelKey)} active>
              <entry.Icon />
            </RailItem>
          ) : null;
        }}
      >
        <SortableGroup
          id={RAIL_GROUP}
          items={order}
          accepts={['rail-item']}
          className="flex h-full min-w-0 flex-1 md:h-auto md:flex-none"
        >
          {/* The group owns no spacing of its own; the column's gap is the
              rail's. On a phone the rail is a tab bar and the items share its width. */}
          <div className="flex h-full min-w-0 flex-1 gap-0.5 md:h-auto md:flex-none md:flex-col md:gap-1.5">
            {order.map((id) => {
              const entry = railEntry(id);
              if (!entry || (id === 'inbox' && !inboxOn)) return null;
              const lists: readonly ConsoleList[] = entry.lists;
              return (
                <SortableRailItem
                  key={id}
                  id={id}
                  label={t(entry.labelKey)}
                  shortLabel={t(entry.shortLabelKey)}
                  count={counts[id]}
                  attention={attentions[id]}
                  active={lists.includes(list)}
                  render={<Link to={entry.to} />}
                >
                  <entry.Icon />
                </SortableRailItem>
              );
            })}
          </div>
        </SortableGroup>
      </DragProvider>
    </Rail>
  );
}
