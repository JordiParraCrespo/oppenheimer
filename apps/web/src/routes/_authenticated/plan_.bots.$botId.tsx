import { createFileRoute } from '@tanstack/react-router';
import { BotChatRoute } from '@/features/bots/screens/bot-chat-route';

/**
 * A bot's chat inside Plan, un-nested (`plan_`) from its board, beside the
 * section's own sidebar.
 */
export const Route = createFileRoute('/_authenticated/plan_/bots/$botId')({
  staticData: { pane: 'full', bar: 'own' },
  component: BotChatRoute,
});
