import { Rail, RailItem, RailMark } from '@oppenheimer/design-system-web';
import { Terminal, Zap } from '@oppenheimer/design-system-web/icons';
import { useSessions } from '@oppenheimer/frontend-consumer/react';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The console's rail: the strip left of the sidebar that switches between
 * its lists (`product/versions/mvp/12-projects-on-the-console.md`,
 * `…/13-automations.md`).
 *
 * Two lists, two links: Sessions with its count, and Automations. Which is
 * current is the router's answer — the automations list is everything under
 * `/automations`, and the sessions list is everything else the console
 * shows, New session and a project page included.
 *
 * A section rather than kit, because the count is a product read; it is the
 * same list the sidebar subscribes to, so the read costs nothing extra.
 */
export function ConsoleRail() {
  const { t } = useTranslation();
  const { data: sessions } = useSessions();
  const matchRoute = useMatchRoute();
  const automations = Boolean(matchRoute({ to: '/automations', fuzzy: true }));

  return (
    <Rail aria-label={t('nav.primaryNavigation')}>
      <RailMark aria-hidden>O</RailMark>
      <RailItem
        label={t('nav.sessions')}
        count={sessions?.length}
        active={!automations}
        render={<Link to="/sessions" />}
      >
        <Terminal />
      </RailItem>
      <RailItem
        label={t('nav.automations')}
        active={automations}
        render={<Link to="/automations" />}
      >
        <Zap />
      </RailItem>
    </Rail>
  );
}
