import { createFileRoute } from '@tanstack/react-router';
import { BotsLandingScreen } from '@/features/bots/screens/bots-landing';

/**
 * `/bots`, the rail's Employees with no bot open
 * (`product/versions/mvp/25-bots.md`): the new-chat greeting at the
 * composer's measure, beside the Employees sidebar (`useConsoleList`).
 */
export const Route = createFileRoute('/_authenticated/bots/')({
  staticData: { pane: 'composer' },
  component: BotsLandingScreen,
});
