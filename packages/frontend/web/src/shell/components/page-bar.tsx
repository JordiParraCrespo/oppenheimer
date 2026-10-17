import { ChatHeader, IconButton, useSidebar } from '@oppenheimer/design-system-web';
import { PanelLeft } from '@oppenheimer/design-system-web/icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PaneBar } from './pane-bar';

/**
 * The quiet panel glyph that folds the sidebar away and back (⌘B does the
 * same), first in every console screen's bar. A screen whose bar is its own
 * toolbar (a pull request's) leads with it; every other screen gets it from
 * `PageBar`.
 */
export function SidebarToggle() {
  const { t } = useTranslation();
  const { toggleSidebar } = useSidebar();
  return (
    <IconButton
      variant="quiet"
      size="sm"
      aria-label={t('nav.toggleSidebar')}
      onClick={toggleSidebar}
    >
      <PanelLeft />
    </IconButton>
  );
}

/**
 * A screen's 48px bar, the one a bot's chat opened with: the sidebar toggle,
 * then the slots, each optional. `leading` sits after the toggle (a bot's
 * face), `title` and its `meta` take the free width, then the run `status`,
 * the view `tabs` and the `actions` on the right. A page whose header names it
 * at display size (Plan's Tasks) passes no title, so the name is said once.
 *
 * It renders into the shell's slot above the page (`PaneBar`), so it stays put
 * while the page scrolls, at the pane's full width whatever measure the route
 * names. One per screen: a screen composed into another's (a session's
 * terminal inside a pull request) leaves the bar to the route it is on.
 */
export function PageBar({
  leading,
  title,
  meta,
  status,
  tabs,
  actions,
}: {
  leading?: ReactNode;
  title?: ReactNode;
  meta?: ReactNode;
  /** The run state: a pulsing `StatusDot` and its word. */
  status?: ReactNode;
  tabs?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <PaneBar>
      <ChatHeader
        leading={
          <>
            <SidebarToggle />
            {leading}
          </>
        }
        title={title}
        meta={meta}
        status={status}
        tabs={tabs}
        actions={actions}
      />
    </PaneBar>
  );
}
