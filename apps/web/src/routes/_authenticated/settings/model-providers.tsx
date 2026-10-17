import { createFileRoute } from '@tanstack/react-router';
import { ModelProvidersSettingsScreen } from '@/features/bots/screens/model-providers-settings';

/** Settings → Model providers: the workspace's keys its bots run on. */
export const Route = createFileRoute('/_authenticated/settings/model-providers')({
  component: ModelProvidersSettingsScreen,
});
