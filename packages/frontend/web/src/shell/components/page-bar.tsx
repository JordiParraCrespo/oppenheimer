import { ChatHeader, IconButton, useSidebar } from '@oppenheimer/design-system-web';
import { PanelLeft } from '@oppenheimer/design-system-web/icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PaneBar } from './pane-bar';

/**
 * The quiet panel glyph that folds the sidebar away and back (⌘B does the
 * same). The shell leads every console page's bar with it; a screen that
 * draws a toolbar of its own (`staticData.bar: 'own'`, a pull request's)
 * leads that toolbar with it.
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
 * The page bar with something in its slots, for a route that declares
 * `staticData.bar: 'own'` (a bot's chat): the sidebar toggle, then
 * `leading` (a bot's face), `title` and its `meta` in the free width, the run
 * `status`, the view `tabs` and the `actions` on the right. A page with
 * nothing to put there renders none: the shell draws the toggle alone.
 *
 * It renders into the shell's slot above the page (`PaneBar`), so it stays put
 * while the page scrolls, at the pane's full width.
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
  title: ReactNode;
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
