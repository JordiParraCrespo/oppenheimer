import {
  DragProvider,
  Rail,
  RailItem,
  RailMark,
  SortableGroup,
  SortableRailItem,
} from '@oppenheimer/design-system-web';
import { useSessions, useTasks } from '@oppenheimer/frontend-consumer/react';
import { useFeatureFlag } from '@oppenheimer/frontend-core/react';
import { useDragLabels } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { lazy, type ReactNode, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConsoleList, useConsoleList } from '@/lib/console';
import { RAIL_GROUP, useRailOrder } from '../hooks/use-rail-order';
import type { RailItemId } from '../lib/rail-landing';
import { railEntry } from '../lib/rail-order';

const InboxRailCount = lazy(() =>
  import('@/features/sessions/sections/inbox-rail-count').then((module) => ({
    default: module.InboxRailCount,
  })),
);

/**
 * The console's rail, switching the sidebar between its lists
 * (`product/versions/mvp/05-screens.md`, `…/13-automations.md`). The current
 * one is `useConsoleList`'s answer, the same the shell picks the sidebar by.
 * A section rather than kit because the counts are product reads: the
 * sessions the sidebar already subscribes to, Plan's open tasks
 * (`18-plan-product.md` §1), the board's own read, and what needs you in
 * the Inbox (`29-inbox.md` §5), whose item is left out while the `inbox`
 * flag is off.
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
  const list = useConsoleList();
  const dragLabels = useDragLabels();
  const inbox = useFeatureFlag('inbox');
  const { order, handlers } = useRailOrder();
  const counts: Partial<Record<RailItemId, ReactNode>> = {
    // Its own chunk: what it composes is the Inbox's, not the console's first load.
    inbox: (
      <Suspense fallback={null}>
        <InboxRailCount />
      </Suspense>
    ),
    sessions: sessionCount,
    plan: openTasks,
  };
  const shown = inbox ? order : order.filter((id) => id !== 'inbox');

  return (
    <Rail aria-label={t('nav.primaryNavigation')}>
      <RailMark aria-hidden>O</RailMark>
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
        <SortableGroup id={RAIL_GROUP} items={shown} accepts={['rail-item']}>
          {/* The group owns no spacing of its own; the column's gap is the
              rail's. On a phone the rail is a bar and the items spread across it. */}
          <div className="flex flex-1 justify-around gap-1.5 md:flex-none md:flex-col md:justify-start">
            {shown.map((id) => {
              const entry = railEntry(id);
              if (!entry) return null;
              const lists: readonly ConsoleList[] = entry.lists;
              return (
                <SortableRailItem
                  key={id}
                  id={id}
                  label={t(entry.labelKey)}
                  count={counts[id]}
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
