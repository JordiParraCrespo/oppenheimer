import { createFileRoute } from '@tanstack/react-router';
import { SentrySettingsScreen } from '@/features/sentry/screens/sentry-settings';

/** Settings → Sentry: the workspace's Sentry organization, whose issues start automations. */
export const Route = createFileRoute('/_authenticated/settings/sentry')({
  component: SentrySettingsScreen,
});
