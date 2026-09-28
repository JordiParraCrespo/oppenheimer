import { RouteError } from '@oppenheimer/frontend-web';
import { createFileRoute } from '@tanstack/react-router';
import { AddHostScreen } from '@/features/hosts/screens/add-host';

/**
 * Settings → Hosts → Add a host: a page inside the Settings frame
 * (`design/version1/Settings.dc.html`) — Back, Hosts / Add a host, Cancel
 * and Done all return to the list. The console pairs a machine in a dialog
 * instead. The column's own gap is the frame's; the page brings its own
 * spacing.
 */
export const Route = createFileRoute('/_authenticated/settings/hosts/new')({
  // Its own boundary, so a thrown render replaces this pane and not the
  // shell around it: without one the error climbs to `_authenticated`.
  errorComponent: RouteError,
  component: SettingsAddHost,
});

function SettingsAddHost() {
  return (
    <div className="flex flex-col">
      <AddHostScreen />
    </div>
  );
}
