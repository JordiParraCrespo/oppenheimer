import { Button } from '@oppenheimer/design-system-web';
import { isSessionNotFound } from '@oppenheimer/frontend-consumer';
import { useSession } from '@oppenheimer/frontend-consumer/react';
import { RouteError, RouteNotFound } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SessionClosed } from '../components/session-closed';
import { SessionSkeleton } from '../components/session-skeleton';
import { SessionProvisioning } from '../sections/session-provisioning';
import { SessionTerminal } from '../sections/session-terminal';

/**
 * One session, in whichever state the URL lands on: a terminal, a pane
 * watching a host start one, a finished session, or nothing. Each is somebody's
 * bookmark, so each answers on its own rather than a terminal opening over a
 * session with no PTY. The query is subscribed here and shared by every branch.
 */
export function SessionScreen({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const { data: session, isPending, error } = useSession(sessionId);

  if (isPending) return <SessionSkeleton />;

  if (error) {
    // A session id that answers 404 is not a failure to retry: it is a
    // destination that will never exist. The 404 is the kit's, like the
    // catch-all route's — a feature may not import another feature's screen,
    // and what they share is the pane, not the button under it.
    if (isSessionNotFound(error)) {
      return (
        <RouteNotFound>
          <Button variant="secondary" render={<Link to="/sessions/new" />}>
            {t('nav.newSession')}
          </Button>
        </RouteNotFound>
      );
    }
    return <RouteError error={error} />;
  }

  // The **lifecycle** decides which pane this is, never the derived group: the
  // group is organised by what needs you, so an `idle` session has a live PTY
  // and a `waiting-on-you` one may be a terminal or a failure. What the pane
  // turns on is whether a terminal exists to attach to.
  if (session.isProvisioning || session.lifecycle === 'failed') {
    return <SessionProvisioning session={session} />;
  }

  if (!session.isLive) {
    // Resolved is a delete: the worktree went with it, so its copy does not
    // point at the branch.
    return (
      <SessionClosed
        name={session.name}
        copy={session.isResolved ? 'sessions.closed.deleted' : 'sessions.closed.description'}
        newSession={<Link to="/sessions/new" />}
      />
    );
  }

  return (
    /* The artboard frames the terminal rather than bleeding it: 14px of canvas
       around a 1040px card, so mono output keeps a readable measure on a wide
       display instead of stretching across it.
       The frame has **no radius**. `SessionsConsole.dc.html` sets
       `border-radius: 0` on this element, and the corners are the whole
       difference between a console surface and a widget sitting on a page:
       rounded, it read as a floating card with the canvas showing round its
       corners, which is the one thing `terminal.css` opens by ruling out —
       "not a widget tucked into a card: it is the whole right-hand side of
       the app". */
    <div className="flex min-h-0 flex-1 flex-col p-3.5">
      <div className="mx-auto flex min-h-0 w-full max-w-260 flex-1 flex-col overflow-hidden">
        <SessionTerminal sessionId={session.id} />
      </div>
    </div>
  );
}
