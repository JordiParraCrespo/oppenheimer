import { createFileRoute } from '@tanstack/react-router';
import { BotChatRoute } from '@/features/bots/screens/bot-chat-route';

/**
 * A bot's chat inside Automations, un-nested (`automations_`) from its page,
 * beside the section's own sidebar (`28-bots-in-sections.md`).
 */
export const Route = createFileRoute('/_authenticated/automations_/bots/$botId')({
  staticData: { pane: 'full', bar: 'own' },
  component: BotChatRoute,
});
