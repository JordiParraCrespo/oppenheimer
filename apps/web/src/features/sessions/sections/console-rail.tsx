import { Rail, RailItem, RailMark } from '@oppenheimer/design-system-web';
import { CircleCheck, GitPullRequest, Terminal, Zap } from '@oppenheimer/design-system-web/icons';
import { useSessions, useTasks } from '@oppenheimer/frontend-consumer/react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useConsoleList } from '@/lib/console';

/**
 * The console's rail, switching the sidebar between its lists
 * (`product/versions/mvp/05-screens.md`, `…/13-automations.md`). The current
 * one is `useConsoleList`'s answer, the same the shell picks the sidebar by.
 * A section rather than kit because the counts are product reads: the
 * sessions the sidebar already subscribes to, and Plan's open tasks
 * (`18-plan-product.md` §1), the board's own read.
 */
export function ConsoleRail() {
  const { t } = useTranslation();
  const { data: sessionCount } = useSessions({ select: (rows) => rows.length });
  const { data: openTasks } = useTasks({
    select: (rows) => rows.filter((row) => !row.isDone).length,
  });
  const list = useConsoleList();

  return (
    <Rail aria-label={t('nav.primaryNavigation')}>
      <RailMark aria-hidden>O</RailMark>
      <RailItem
        label={t('nav.sessions')}
        count={sessionCount}
        active={list === 'sessions'}
        render={<Link to="/sessions/new" />}
      >
        <Terminal />
      </RailItem>
      <RailItem
        label={t('nav.pullRequests')}
        active={list === 'pulls'}
        render={<Link to="/pulls" />}
      >
        <GitPullRequest />
      </RailItem>
      <RailItem
        label={t('nav.automations')}
        active={list === 'automations'}
        render={<Link to="/automations" />}
      >
        <Zap />
      </RailItem>
      <RailItem
        label={t('nav.plan')}
        count={openTasks}
        active={list === 'tasks' || list === 'calendar'}
        render={<Link to="/plan" />}
      >
        <CircleCheck />
      </RailItem>
    </Rail>
  );
}
