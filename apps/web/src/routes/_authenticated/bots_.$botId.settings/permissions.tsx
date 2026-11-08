import { createFileRoute } from '@tanstack/react-router';
import { botPermissionsSearchSchema } from '@/features/bots/lib/tool-search';
import { BotPermissionsScreen } from '@/features/bots/screens/bot-permissions';

export const Route = createFileRoute('/_authenticated/bots_/$botId/settings/permissions')({
  validateSearch: botPermissionsSearchSchema,
  component: BotPermissionsRoute,
});

function BotPermissionsRoute() {
  const { botId } = Route.useParams();
  return <BotPermissionsScreen botId={botId} />;
}
