import { createFileRoute } from '@tanstack/react-router';
import { modelProvidersSearchSchema } from '@/features/bots/lib/model-providers-search';
import { ModelProvidersSettingsScreen } from '@/features/bots/screens/model-providers-settings';

/** Settings → Model providers: the workspace's keys, and what voice runs on (`?tab=voice`). */
export const Route = createFileRoute('/_authenticated/settings/model-providers')({
  validateSearch: modelProvidersSearchSchema,
  component: ModelProvidersSettingsScreen,
});
