import { Rail, RailItem, RailMark } from '@oppenheimer/design-system-web';
import { Terminal, Zap } from '@oppenheimer/design-system-web/icons';
import { useSessions } from '@oppenheimer/frontend-consumer/react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useConsoleList } from '@/lib/console';

/**
 * The console's rail, switching the sidebar between its lists
 * (`product/versions/mvp/05-screens.md`, `…/13-automations.md`). The current
 * one is `useConsoleList`'s answer, the same the shell picks the sidebar by.
 * A section rather than kit because the count is a product read; it is the
 * list the sidebar already subscribes to, so it costs nothing extra.
 */
export function ConsoleRail() {
  const { t } = useTranslation();
  const { data: sessions } = useSessions();
  const list = useConsoleList();

  return (
    <Rail aria-label={t('nav.primaryNavigation')}>
      <RailMark aria-hidden>O</RailMark>
      <RailItem
        label={t('nav.sessions')}
        count={sessions?.length}
        active={list === 'sessions'}
        render={<Link to="/sessions/new" />}
      >
        <Terminal />
      </RailItem>
      <RailItem
        label={t('nav.automations')}
        active={list === 'automations'}
        render={<Link to="/automations" />}
      >
        <Zap />
      </RailItem>
    </Rail>
  );
}
