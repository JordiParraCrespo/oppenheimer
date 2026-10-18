import { SettingsContent, SettingsMain, SettingsShell } from '@oppenheimer/design-system-web';
import { Cpu, Eye, KeyRound, User } from '@oppenheimer/design-system-web/icons';
import { SettingsSidebar } from '@oppenheimer/frontend-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { HostCount } from '@/features/hosts/sections/host-count';
import { WatchedCount } from '@/features/pull-requests/sections/watched-count';

/**
 * Settings: its own chrome beside the console
 * (`design/version1/Settings.dc.html`, `product/versions/mvp/05-screens.md`).
 * Under `_authenticated` for its guard and no-workspace redirect;
 * `shell: 'own'` tells that route to render no `AppShell`, since the console's
 * rail and session list are not part of Settings.
 */
export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsLayout,
  staticData: { shell: 'own' },
});

function SettingsLayout() {
  return (
    // On a phone the nav is a strip over the page (`SettingsNav`).
    <SettingsShell className="flex-col md:flex-row">
      <SettingsSidebar
        back="/sessions/new"
        groups={[
          {
            labelKey: 'account',
            items: [
              { to: '/settings/profile', icon: User, labelKey: 'profile' },
              { to: '/settings/repositories', icon: Eye, labelKey: 'repositories' },
            ],
          },
          {
            labelKey: 'workspace',
            items: [
              { to: '/settings/hosts', icon: Cpu, labelKey: 'hosts' },
              { to: '/settings/model-providers', icon: KeyRound, labelKey: 'modelProviders' },
            ],
          },
        ]}
        // The rows with a number: a section of their own, so the list each
        // reads re-renders the count and not the nav.
        renderCount={(to) =>
          to === '/settings/hosts' ? (
            <HostCount />
          ) : to === '/settings/repositories' ? (
            <WatchedCount />
          ) : undefined
        }
      />
      <SettingsMain>
        <SettingsContent>
          <Outlet />
        </SettingsContent>
      </SettingsMain>
    </SettingsShell>
  );
}
