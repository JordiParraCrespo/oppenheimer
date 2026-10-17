import { createFileRoute } from '@tanstack/react-router';
import { WatchedRepositoriesSettingsScreen } from '@/features/pull-requests/screens/watched-repositories-settings';

/** Settings → Watched repositories: whose open pull requests the queue's Watching scope shows. */
export const Route = createFileRoute('/_authenticated/settings/repositories')({
  component: WatchedRepositoriesSettingsScreen,
});
