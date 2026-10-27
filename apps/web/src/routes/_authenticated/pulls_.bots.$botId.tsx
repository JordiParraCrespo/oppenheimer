import { createFileRoute } from '@tanstack/react-router';
import { BotChatScreen } from '@/features/bots/screens/bot-chat';

/**
 * `/pulls/bots/$botId`: a bot's chat inside Pull requests, beside the
 * section's own sidebar (`product/versions/mvp/28-bots-in-sections.md`), as
 * `PullRequests.dc.html` draws it. The same chat as `/bots/$botId`, the same
 * conversation; only the list beside the rail differs, which the address
 * decides (`useConsoleList`). Un-nested (`pulls_`) like a pull request, since
 * the chat takes the whole pane.
 */
export const Route = createFileRoute('/_authenticated/pulls_/bots/$botId')({
  staticData: { pane: 'full', bar: 'own' },
  component: PullRequestsBotChatRoute,
});

function PullRequestsBotChatRoute() {
  const { botId } = Route.useParams();
  // Keyed, so moving between two bots starts the chat afresh (its draft included).
  return <BotChatScreen key={botId} botId={botId} />;
}
