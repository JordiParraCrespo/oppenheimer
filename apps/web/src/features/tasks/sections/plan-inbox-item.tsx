import { RoutineItem, useNow } from '@oppenheimer/design-system-web';
import { Bell } from '@oppenheimer/design-system-web/icons';
import { useInboxCount } from '@oppenheimer/frontend-consumer/react';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The Inbox, first in Plan's sidebar (the 2026-10-29 `Tasks` frame), with
 * how many things need you once every read has answered. A row of its own
 * so the minute tick that keeps the count honest redraws only it.
 */
export function PlanInboxItem() {
  const { t } = useTranslation();
  const now = useNow(60_000);
  const needs = useInboxCount(now);
  const matchRoute = useMatchRoute();

  return (
    <RoutineItem
      name={t('tasks.nav.inbox')}
      icon={<Bell />}
      meta={needs === undefined ? undefined : String(needs)}
      active={Boolean(matchRoute({ to: '/plan/inbox' }))}
      nativeButton={false}
      render={<Link to="/plan/inbox" />}
    />
  );
}
