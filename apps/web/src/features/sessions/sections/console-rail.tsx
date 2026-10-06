import {
  DragProvider,
  Rail,
  RailItem,
  RailMark,
  SortableGroup,
  SortableRailItem,
} from '@oppenheimer/design-system-web';
import { CircleCheck, GitPullRequest, Terminal, Zap } from '@oppenheimer/design-system-web/icons';
import { useSessions, useTasks } from '@oppenheimer/frontend-consumer/react';
import { useDragLabels } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useConsoleList } from '@/lib/console';
import { useRailOrder } from '../hooks/use-rail-order';
import type { RailItemId } from '../lib/rail-order';

/**
 * The console's rail, switching the sidebar between its lists
 * (`product/versions/mvp/05-screens.md`, `…/13-automations.md`). The current
 * one is `useConsoleList`'s answer, the same the shell picks the sidebar by.
 * A section rather than kit because the counts are product reads: the
 * sessions the sidebar already subscribes to, and Plan's open tasks
 * (`18-plan-product.md` §1), the board's own read.
 *
 * The reader drags the items into their own order, as the design's rail
 * does; a press still opens the list, and the order is kept on this device
 * (`useRailOrder`).
 */
export function ConsoleRail() {
  const { t } = useTranslation();
  const { data: sessionCount } = useSessions({ select: (rows) => rows.length });
  const { data: openTasks } = useTasks({
    select: (rows) => rows.filter((row) => !row.isDone).length,
  });
  const list = useConsoleList();
  const dragLabels = useDragLabels();
  const { group, order, handlers } = useRailOrder();

  const items: Record<
    RailItemId,
    { label: string; icon: ReactNode; count?: number; active: boolean; link: ReactElement }
  > = {
    sessions: {
      label: t('nav.sessions'),
      icon: <Terminal />,
      count: sessionCount,
      active: list === 'sessions',
      link: <Link to="/sessions/new" />,
    },
    pulls: {
      label: t('nav.pullRequests'),
      icon: <GitPullRequest />,
      active: list === 'pulls',
      link: <Link to="/pulls" />,
    },
    automations: {
      label: t('nav.automations'),
      icon: <Zap />,
      active: list === 'automations',
      link: <Link to="/automations" />,
    },
    plan: {
      label: t('nav.plan'),
      icon: <CircleCheck />,
      count: openTasks,
      active: list === 'tasks' || list === 'calendar',
      link: <Link to="/plan" />,
    },
  };

  return (
    <Rail aria-label={t('nav.primaryNavigation')}>
      <RailMark aria-hidden>O</RailMark>
      <DragProvider
        {...handlers}
        labels={dragLabels}
        overlay={(active) => {
          const item = items[active.id as RailItemId];
          return item ? (
            <RailItem label={item.label} active>
              {item.icon}
            </RailItem>
          ) : null;
        }}
      >
        <SortableGroup id={group} items={order} accepts={['rail-item']}>
          <div className="flex flex-col gap-1.5">
            {order.map((id) => {
              const item = items[id];
              return (
                <SortableRailItem
                  key={id}
                  id={id}
                  label={item.label}
                  count={item.count}
                  active={item.active}
                  render={item.link}
                >
                  {item.icon}
                </SortableRailItem>
              );
            })}
          </div>
        </SortableGroup>
      </DragProvider>
    </Rail>
  );
}
