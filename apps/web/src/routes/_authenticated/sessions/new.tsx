import { createFileRoute } from '@tanstack/react-router';
import { BotOpenTab } from '@/features/bots/sections/bot-open-tab';
import { newSessionSearchSchema } from '@/features/sessions/lib/new-session-search';
import { NewSessionScreen } from '@/features/sessions/screens/new-session';
import { SessionTabs } from '@/features/sessions/sections/session-tabs';

/**
 * New session: the composer at the pane's foot, at the `prompt` measure,
 * under the open tabs, which this screen's own bar keeps. The pane is its
 * drop zone (`usePaneDrop`).
 *
 * `?project=` and `?host=`: see `newSessionSearchSchema`.
 */
export const Route = createFileRoute('/_authenticated/sessions/new')({
  component: NewSessionRoute,
  staticData: { pane: 'prompt', bar: 'own' },
  validateSearch: newSessionSearchSchema,
});

// The tabs are the sessions feature's and a bot's tab the bots feature's:
// the route composes them, so the tabs open elsewhere stay in view here.
function NewSessionRoute() {
  return (
    <NewSessionScreen
      tabs={<SessionTabs shown={null} bot={(id, tab) => <BotOpenTab botId={id} {...tab} />} />}
    />
  );
}
