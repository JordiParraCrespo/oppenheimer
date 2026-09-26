import { createFileRoute } from '@tanstack/react-router';
import { AutomationsScreen } from '@/features/routines/screens/automations';

/** The overview on its Automations tab: the table and the templates. */
export const Route = createFileRoute('/_authenticated/automations/')({
  component: AutomationsScreen,
});
