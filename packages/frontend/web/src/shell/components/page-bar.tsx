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
      // Over an image a screen lays under the whole pane it stands on a frosted chip.
      data-pane-chrome
      aria-label={t('nav.toggleSidebar')}
      onClick={toggleSidebar}
    >
      <PanelLeft />
    </IconButton>
  );
}

/**
 * A bar of tabs (`tone="chrome"`): 45px (`--tab-bar-h`), on the terminal's
 * ground (`--term-bg`, grey in dark, never the canvas's black) wherever it is
 * drawn, a session, a bot's chat or New session, with a hairline at its foot,
 * so it keeps its colour when a session is created. The shown tab's card is
 * a step up from that ground (`--card-active`), so it stands out on it. A tab stands on the medium rung
 * (the small one is pointed there on each tab, so its caller says nothing);
 * every other control in the bar, the toggles, +, Share and the menus, stays
 * on the small rung with its small glyph, quieter than the tabs.
 */
const TAB_BAR =
  'h-(--tab-bar-h) border-b border-border-subtle bg-term-bg [--chat-tab-ground:var(--term-bg)] [--chat-tab-lit:var(--card-active)] [&_[data-slot=chat-tab]]:[--control-h-sm:var(--control-h-md)]';

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
   * bar's height (`--tab-bar-h`), on the terminal's ground (`TAB_BAR`).
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
