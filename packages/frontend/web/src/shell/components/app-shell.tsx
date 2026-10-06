import {
  EditorPage,
  EditorPageBody,
  SidebarInset,
  SidebarProvider,
} from '@oppenheimer/design-system-web';
import { useMatches } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useApplyUserSettings } from '../../i18n';
import { type ShellConfig, ShellProvider } from '../hooks/use-shell';
import { resolveContentPane } from '../lib/pane';
import { AppSidebar } from './app-sidebar';
import { CommandPalette } from './command-palette';
import { TopBar } from './top-bar';

/**
 * The authenticated chrome: sidebar, an optional 56px bar, ⌘K, and a content
 * column the route decides the shape of (`lib/pane.ts`): the page frame at
 * the measure it names, or the bare pane for a screen that owns it. An app's `_authenticated` route
 * decides who gets in and what the shell shows (its nav or its own sidebar
 * body, its brand row, its account-menu links), then mounts this around its
 * `Outlet`.
 *
 * The bar and the palette are the full chrome, and an app says whether it
 * wears them with `chrome` (`use-shell.ts` says why the console does not).
 */
export function AppShell({ children, ...config }: ShellConfig & { children: ReactNode }) {
  const chrome = config.chrome ?? true;
  const [commandOpen, setCommandOpen] = useState(false);
  useApplyUserSettings();
  const pane = useMatches({ select: resolveContentPane });
  // One frame scrolls every page, so a new page has to start it afresh, or the
  // board scrolled halfway down would open the automations halfway down. Keyed
  // by the route rather than the address: `?task=` over the board is the
  // same page and keeps its place.
  const page = useMatches({ select: (matches) => matches.at(-1)?.routeId });

  return (
    <ShellProvider value={config}>
      <SidebarProvider className="h-svh min-h-0">
        {config.rail}
        <AppSidebar />
        <SidebarInset className="flex min-h-0 min-w-0 flex-col">
          {chrome ? <TopBar onSearch={() => setCommandOpen(true)} /> : null}
          {/* The column is a flex column that never scrolls itself: a page
              scrolls inside its frame, and a `full` screen — whose content
              *is* the viewport, the session terminal — fills the height with
              `flex-1` instead of guessing at a viewport calculation. */}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {pane === 'full' ? (
              <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
            ) : (
              <EditorPage key={page}>
                <EditorPageBody size={pane}>{children}</EditorPageBody>
              </EditorPage>
            )}
          </main>
        </SidebarInset>
        {chrome ? <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} /> : null}
      </SidebarProvider>
    </ShellProvider>
  );
}
