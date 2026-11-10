import { createFileRoute } from '@tanstack/react-router';
import { HostDesktopScreen } from '@/features/hosts/screens/host-desktop';

/**
 * Settings → Hosts → a host's Desktop: the machine's own screen, a page inside
 * the Settings frame like Add a host, reached from the host's row.
 */
export const Route = createFileRoute('/_authenticated/settings/hosts/$hostId/desktop')({
  component: SettingsHostDesktop,
});

function SettingsHostDesktop() {
  const { hostId } = Route.useParams();
  return (
    <div className="flex flex-col">
      <HostDesktopScreen hostId={hostId} />
    </div>
  );
}
