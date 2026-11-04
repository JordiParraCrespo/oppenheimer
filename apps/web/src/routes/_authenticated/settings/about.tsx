import { createFileRoute } from '@tanstack/react-router';
import { AboutSettingsScreen } from '@/features/release/screens/about-settings';

/** Settings → About: which release of the console and of the API is running. */
export const Route = createFileRoute('/_authenticated/settings/about')({
  component: AboutSettingsScreen,
});
