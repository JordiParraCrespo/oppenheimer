import { SettingsContent, SettingsMain, SettingsShell } from '@oppenheimer/design-system-web';
import { Cpu, User } from '@oppenheimer/design-system-web/icons';
import { SettingsSidebar } from '@oppenheimer/frontend-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { HostCount } from '@/features/hosts/sections/host-count';

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
    <SettingsShell>
      <SettingsSidebar
        back="/sessions/new"
        groups={[
          {
            labelKey: 'account',
            items: [{ to: '/settings/profile', icon: User, labelKey: 'profile' }],
          },
          {
            labelKey: 'workspace',
            items: [{ to: '/settings/hosts', icon: Cpu, labelKey: 'hosts' }],
          },
        ]}
        // The one row with a number: a section of its own, so the list it
        // reads re-renders the count and not the nav.
        renderCount={(to) => (to === '/settings/hosts' ? <HostCount /> : undefined)}
      />
      <SettingsMain>
        <SettingsContent>
          <Outlet />
        </SettingsContent>
      </SettingsMain>
    </SettingsShell>
  );
}
