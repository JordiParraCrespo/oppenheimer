import { createFileRoute } from '@tanstack/react-router';
import { BotChatRoute } from '@/features/bots/screens/bot-chat-route';

/**
 * A bot's chat inside Pull requests, un-nested (`pulls_`) from the queue,
 * beside the section's own sidebar (`28-bots-in-sections.md`).
 */
export const Route = createFileRoute('/_authenticated/pulls_/bots/$botId')({
  staticData: { pane: 'full', bar: 'own' },
  component: BotChatRoute,
});
