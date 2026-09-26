import { SettingsContent, SettingsMain, SettingsShell } from '@oppenheimer/design-system-web';
import { Cpu, User } from '@oppenheimer/design-system-web/icons';
import { SettingsSidebar } from '@oppenheimer/frontend-web';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { HostCount } from '@/features/hosts/sections/host-count';

/**
 * Settings: its own chrome, beside the console rather than inside it
 * (`design/version1/Settings.dc.html`, `product/versions/mvp/05-screens.md`).
 * The sidebar is the settings nav — Back to console, then Account and
 * Workspace — and the main column is the frame each page fills. The console's
 * rail and session list are not here, which is why this is a layout of its
 * own under `__root` and not a child of `_authenticated`.
 *
 * Guarded the way `_authenticated` is: a signed-out visitor is sent to the
 * login page and returned here.
 */
export const Route = createFileRoute('/settings')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <SettingsShell>
      <SettingsSidebar
        back="/sessions"
        groups={[
          {
            labelKey: 'account',
            items: [{ to: '/settings/profile', icon: User, labelKey: 'profile' }],
          },
          {
            labelKey: 'workspace',
            items: [{ to: '/settings/hosts', icon: Cpu, labelKey: 'hosts', count: <HostCount /> }],
          },
        ]}
      />
      <SettingsMain>
        <SettingsContent>
          <Outlet />
        </SettingsContent>
      </SettingsMain>
    </SettingsShell>
  );
}
