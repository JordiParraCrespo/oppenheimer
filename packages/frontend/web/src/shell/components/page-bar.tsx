import { ChatHeader, cn, IconButton, useSidebar } from '@oppenheimer/design-system-web';
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
      // Over an image the pane lays under itself it stands on a frosted chip.
      data-pane-chrome
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
/**
 * A bar of tabs (`tone="chrome"`): 45px (`--tab-bar-h`), with no ground of
 * its own, so it is the colour of the page under it (a session's terminal,
 * which names it in `className`, the pane, New session's image) and a
 * hairline marks its foot, gone over an image. Every control in it stands
 * on the medium rung: the small one is pointed there inside the bar, so a
 * tab, a toggle or Share grows with the bar without its caller saying so,
 * and an icon at a button's own size takes the medium glyph.
 */
const TAB_BAR =
  'h-(--tab-bar-h) border-b border-border-subtle bg-transparent [--chat-tab-ground:var(--canvas-recessed)] [--control-h-sm:var(--control-h-md)] [&_[data-slot=icon-button]_svg:not([class*=size-])]:size-4 group-has-data-pane-backdrop/pane:border-transparent';

export function PageBar({
  leading,
  title,
  meta,
  status,
  tabs,
  actions,
  tone = 'page',
  className,
}: {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** The run state: a pulsing `StatusDot` and its word. */
  status?: ReactNode;
  tabs?: ReactNode;
  actions?: ReactNode;
  /**
   * `chrome`: the bar is a strip of open tabs (`ChatTabStrip`) at the tab
   * bar's height (`--tab-bar-h`), on the page's own ground (`TAB_BAR`).
   */
  tone?: 'page' | 'chrome';
  /** The bar's ground and edge, when the page under it is not the shell's (a session's terminal). */
  className?: string;
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
        className={cn(tone === 'chrome' && TAB_BAR, className)}
      />
    </PaneBar>
  );
}
