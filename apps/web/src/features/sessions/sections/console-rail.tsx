import { Rail, RailItem, RailMark } from '@oppenheimer/design-system-web';
import { Terminal, Zap } from '@oppenheimer/design-system-web/icons';
import { useSessions } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';

/**
 * The console's rail: the strip left of the sidebar that switches between
 * its lists (`product/versions/mvp/12-projects-on-the-console.md`).
 *
 * Sessions is the one list the console has today, so it is the current item
 * and carries the count. Routines is drawn where the export draws it and
 * disabled: a control that goes nowhere is worse than one that says it is
 * not here yet, and the tooltip says so. It becomes a link when the routines
 * page lands.
 *
 * A section rather than kit, because the count is a product read; it is the
 * same list the sidebar subscribes to, so the read costs nothing extra.
 */
export function ConsoleRail() {
  const { t } = useTranslation();
  const { data: sessions } = useSessions();

  return (
    <Rail aria-label={t('nav.primaryNavigation')}>
      <RailMark aria-hidden>O</RailMark>
      <RailItem label={t('nav.sessions')} count={sessions?.length} active>
        <Terminal />
      </RailItem>
      <RailItem label={t('sessions.sidebar.routinesSoon')} disabled aria-disabled>
        <Zap />
      </RailItem>
    </Rail>
  );
}
