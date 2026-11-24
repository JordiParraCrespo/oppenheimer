import { createFileRoute } from '@tanstack/react-router';
import { BotChatScreen } from '@/features/bots/screens/bot-chat';
import { BotOpenTab } from '@/features/bots/sections/bot-open-tab';
import { SessionTabs } from '@/features/sessions/sections/session-tabs';

/**
 * A bot's chat inside Sessions, beside the section's own sidebar, under the
 * tabs of what this device has open there. Keyed by the bot, so moving
 * between two starts the chat afresh, its draft included. The tabs are the
 * sessions feature's and a bot's tab the bots feature's: the route composes
 * them.
 */
export const Route = createFileRoute('/_authenticated/sessions/bots/$botId')({
  staticData: { pane: 'full', bar: 'own' },
  component: SectionBotRoute,
});

function SectionBotRoute() {
  const { botId } = Route.useParams();
  return (
    <BotChatScreen
      key={botId}
      botId={botId}
      tabs={
        <SessionTabs
          shown={{ kind: 'bot', id: botId }}
          bot={(id, tab) => <BotOpenTab botId={id} {...tab} />}
        />
      }
    />
  );
}
