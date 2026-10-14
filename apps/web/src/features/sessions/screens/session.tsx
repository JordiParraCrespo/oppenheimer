import { Button } from '@oppenheimer/design-system-web';
import { isSessionNotFound } from '@oppenheimer/frontend-consumer';
import { QueryState, RouteError, RouteNotFound } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionSkeleton } from '../components/session-skeleton';
import { SessionPane } from '../sections/session-pane';

/**
 * One session, in whichever state the URL lands on. The pane reads the
 * session under Suspense; this draws its placeholder and a first failure. A
 * session id that answers 404 is not a failure to retry: it is a destination
 * that will never exist, said with the kit's 404, like the catch-all route's —
 * a feature may not import another feature's screen, and what they share is
 * the pane, not the button under it.
 */
export function SessionScreen({
  sessionId,
  closed,
  statusItem,
  composer,
}: {
  sessionId: string;
  /**
   * An input row under the terminal, with this placeholder: a pull request's
   * review session has one. The route composes it, as `statusItem`.
   */
  composer?: string;
  /**
   * A chip at the head of the terminal's status bar: the task this session is
   * on ("Back to task", `18-plan-product.md` §4). The route composes it, since
   * the task is the tasks feature's.
   */
  statusItem?: ReactNode;
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
        <SessionSkeleton />
      </QueryState.Pending>
      <QueryState.Error>
        {(error, retry) =>
          isSessionNotFound(error) ? (
            <RouteNotFound>
              <Button variant="secondary" render={<Link to="/sessions/new" />}>
                {t('nav.newSession')}
              </Button>
            </RouteNotFound>
          ) : (
            <RouteError error={error} onRetry={retry} />
          )
        }
      </QueryState.Error>
      <QueryState.Data>
        <SessionPane
          sessionId={sessionId}
          closed={closed}
          statusItem={statusItem}
          composer={composer}
        />
      </QueryState.Data>
    </QueryState>
  );
}
