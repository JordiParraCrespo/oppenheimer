import { createFileRoute, Outlet } from '@tanstack/react-router';
import { HostsSettingsNav } from '@/features/hosts/sections/settings-nav';

/**
 * Settings: its own frame, not the console's (`design/version1/Settings.dc.html`)
 * — the settings nav where the rail and the session list were, and a 760px
 * column that scrolls on its own. `frame: 'own'` tells the `_authenticated`
 * layout to draw nothing around it but its guards.
 */
export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsLayout,
  staticData: { frame: 'own' },
});

function SettingsLayout() {
  return (
    <div className="flex h-svh overflow-hidden bg-background text-fg">
      <HostsSettingsNav />
      <main className="min-w-0 flex-1 overflow-y-auto bg-canvas">
        <div className="mx-auto flex max-w-[760px] flex-col px-10 pt-16 pb-24">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
