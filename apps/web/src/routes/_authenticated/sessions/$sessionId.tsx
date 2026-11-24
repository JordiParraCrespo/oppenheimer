import { createFileRoute } from '@tanstack/react-router';
import { BotOpenTab } from '@/features/bots/sections/bot-open-tab';
import { BotSideChat } from '@/features/bots/sections/bot-side-chat';
import { SessionScreen } from '@/features/sessions/screens/session';
import { SessionTabs } from '@/features/sessions/sections/session-tabs';
import { SessionTaskLink } from '@/features/tasks/sections/session-task-link';

/**
 * One session. The screen owns the pane — a terminal sizes itself from the box
 * it is given, so the shell gives it the whole one and keeps no scroll of its
 * own; `staticData.pane` is read by `AppShell`. It owns the bar too: the
 * session's name, state, view switch and Share sit in it (`bar: 'own'`).
 */
export const Route = createFileRoute('/_authenticated/sessions/$sessionId')({
  component: SessionRoute,
  staticData: { pane: 'full', bar: 'own' },
});

function SessionRoute() {
  const { sessionId } = Route.useParams();

  // Keyed by the id: moving between two sessions is a different terminal, a
  // different socket and a different scrollback, not the same component with
  // new props. Without it xterm would keep the previous session's grid.
  // The task chip is the tasks feature's, a bot's chat in the side pane and
  // a bot's tab the bots feature's, the tabs this one's: the route composes them.
  return (
    <SessionScreen
      key={sessionId}
      sessionId={sessionId}
      bar={{
        back: <SessionTaskLink sessionId={sessionId} />,
        open: (
          <SessionTabs
            shown={{ kind: 'session', id: sessionId }}
            bot={(id, tab) => <BotOpenTab botId={id} {...tab} />}
          />
        ),
      }}
      sideBot={(botId) => <BotSideChat botId={botId} />}
    />
  );
}
