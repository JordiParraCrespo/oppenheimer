import { Button, Skeleton } from '@oppenheimer/design-system-web';
import { isSessionNotFound } from '@oppenheimer/frontend-consumer';
import { PageBar, QueryState, RouteError, RouteNotFound } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionSkeleton } from '../components/session-skeleton';
import type { SessionView } from '../lib/chat-blocks';
import { SessionPane } from '../sections/session-pane';
import { SessionTerminal } from '../sections/session-terminal';

/**
 * One session, in whichever state the URL lands on. The pane reads the
 * session under Suspense; this draws its placeholder and a first failure. A
 * session id that answers 404 is not a failure to retry: it is a destination
 * that will never exist, said with the kit's 404, like the catch-all route's —
 * a feature may not import another feature's screen, and what they share is
 * the pane, not the button under it.
 *
 * With `bar`, the route has declared `staticData.bar: 'own'` and this screen
 * draws the session's bar in every state: a bar of the name's width while
 * the session is read, the toggle alone over a failure, `SessionBar` once it
 * answers.
 */
export function SessionScreen({
  sessionId,
  initialView,
  closed,
  bar,
}: {
  sessionId: string;
  /** The view the pane opens on, Terminal unless the route says Chat. */
  initialView?: SessionView;
  /**
   * Present: the screen draws the session's bar. `back` leads it with the task
   * this session is on ("Back to task", `18-plan-product.md` §4); the route
   * composes it, since the task is the tasks feature's.
   */
  bar?: { back?: ReactNode };
  /**
   * What to draw instead of the session's own stopped pane.
   *
   * A run opened from the automations list is the same terminal and a
   * different thing to say about it: 16 §Resume calls a run's end "the turn
   * ended, the session did not", and the way back in is **Open in terminal**,
   * not Restart, with no New session under it. The route composes the two —
   * the terminal is this feature's, the run's vocabulary is the automations
   * feature's, and neither imports the other.
   */
  closed?: (session: {
    name: string;
    branch: string | null;
    restart: () => void;
    restarting: boolean;
  }) => ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <QueryState>
      <QueryState.Pending>
        {bar ? <PageBar title={<Skeleton className="h-4 w-40" />} /> : null}
        <SessionSkeleton />
      </QueryState.Pending>
      <QueryState.Error>
        {(error, retry) => (
          <>
            {bar ? <PageBar title={null} /> : null}
            {isSessionNotFound(error) ? (
              <RouteNotFound>
                <Button variant="secondary" render={<Link to="/sessions/new" />}>
                  {t('nav.newSession')}
                </Button>
              </RouteNotFound>
            ) : (
              <RouteError error={error} onRetry={retry} />
            )}
          </>
        )}
      </QueryState.Error>
      <QueryState.Data>
        <SessionPane
          sessionId={sessionId}
          initialView={initialView}
          closed={closed}
          bar={bar}
          terminal={(session, reading, statusItems) => (
            <SessionTerminal
              sessionId={session.id}
              hostId={session.hostId}
              statusItems={statusItems}
              showLive={!bar}
              reading={reading}
            />
          )}
        />
      </QueryState.Data>
    </QueryState>
  );
}
