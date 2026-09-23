import { SidebarInset, SidebarProvider } from '@oppenheimer/design-system-web';
import { useMatches } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useApplyUserSettings } from '../../i18n';
import { type ShellConfig, ShellProvider } from '../hooks/use-shell';
import { resolveContentPane } from '../lib/pane';
import { AppSidebar } from './app-sidebar';
import { CommandPalette } from './command-palette';
import { TopBar } from './top-bar';

/**
 * How each pane frames a screen. `measure` is the reading column every text
 * screen wants; `full` hands the whole content area to the screen and keeps no
 * scroll of its own, which is what a terminal needs — see `lib/pane.ts`.
 */
const PANE = {
  measure: {
    main: 'overflow-y-auto px-6 pt-8 pb-16 md:px-12 md:pt-11',
    track: 'mx-auto flex w-full max-w-[1080px] flex-1 flex-col',
  },
  full: {
    main: 'overflow-hidden',
    track: 'flex min-h-0 w-full flex-1 flex-col',
  },
} as const;

/**
 * The authenticated chrome: sidebar, an optional 56px bar, ⌘K, and a content
 * column the route decides the shape of. An app's `_authenticated` route
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
  // The saved theme and language become this device's defaults — once, and
  // only where the device has not chosen for itself.
  useApplyUserSettings();
  const pane = PANE[useMatches({ select: resolveContentPane })];

  return (
    <ShellProvider value={config}>
      <SidebarProvider className="h-svh min-h-0">
        <AppSidebar />
        <SidebarInset className="flex min-h-0 min-w-0 flex-col">
          {chrome ? <TopBar onSearch={() => setCommandOpen(true)} /> : null}
          {/* The column is a flex column, and its inner track stretches, so a
              screen whose content *is* the viewport — the session terminal —
              can fill the height with `flex-1` instead of guessing at a
              viewport calculation. Screens whose children size themselves are
              unaffected: nothing here sets `flex-1` on them. */}
          <main className={`flex min-h-0 min-w-0 flex-1 flex-col ${pane.main}`}>
            <div className={pane.track}>{children}</div>
          </main>
        </SidebarInset>
        {chrome ? <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} /> : null}
      </SidebarProvider>
    </ShellProvider>
  );
}
