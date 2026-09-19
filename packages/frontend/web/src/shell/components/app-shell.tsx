import { SidebarInset, SidebarProvider } from '@oppenheimer/design-system-web';
import { type ReactNode, useState } from 'react';
import { useApplyUserSettings } from '../../i18n';
import { type ShellConfig, ShellProvider } from '../hooks/use-shell';
import { AppSidebar } from './app-sidebar';
import { CommandPalette } from './command-palette';
import { TopBar } from './top-bar';

/**
 * The authenticated chrome: sidebar, the 56px bar, ⌘K, and a scrolling content
 * column capped at 1080px so a page's measure stays readable on a wide
 * display. An app's `_authenticated` route decides who gets in and what the
 * shell shows (its nav, its account-menu links, its workspace), then mounts
 * this around its `Outlet`.
 */
export function AppShell({ children, ...config }: ShellConfig & { children: ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  // The saved theme and language become this device's defaults — once, and
  // only where the device has not chosen for itself.
  useApplyUserSettings();

  return (
    <ShellProvider value={config}>
      <SidebarProvider className="h-svh min-h-0">
        <AppSidebar />
        <SidebarInset className="flex min-h-0 min-w-0 flex-col">
          <TopBar onSearch={() => setCommandOpen(true)} />
          {/* The column is a flex column, and its inner track stretches, so a
              screen whose content *is* the viewport — the session terminal —
              can fill the height with `flex-1` instead of guessing at a
              viewport calculation. Screens whose children size themselves are
              unaffected: nothing here sets `flex-1` on them. */}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 pt-8 pb-16 md:px-12 md:pt-11">
            <div className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col">{children}</div>
          </main>
        </SidebarInset>
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      </SidebarProvider>
    </ShellProvider>
  );
}
