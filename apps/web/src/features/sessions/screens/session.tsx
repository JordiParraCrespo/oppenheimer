import { Button } from '@oppenheimer/design-system-web';
import { isSessionNotFound } from '@oppenheimer/frontend-consumer';
import { useRestartSession, useSession } from '@oppenheimer/frontend-consumer/react';
import { RouteError, RouteNotFound } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
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
export function SessionScreen({
  sessionId,
  closed,
}: {
  sessionId: string;
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
  const { data: session, isPending, error } = useSession(sessionId);
  // The way back from a stopped session. Held here because this screen is the
  // one that branches on the lifecycle; the pane below it takes props only.
  const restart = useRestartSession();

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
    // point at the branch, and there is nothing left to restart. A stopped
    // session still has everything — the worktree, the branch, and the agent's
    // own conversation — so it offers the way back.
    const branch = session.isResolved ? null : (session.cwdCheckout?.branch ?? null);
    if (closed) {
      return closed({
        name: session.name,
        branch,
        restart: () => restart.mutate(session.id),
        restarting: restart.isPending,
      });
    }
    return (
      <SessionClosed
        name={session.name}
        copy={session.isResolved ? 'sessions.closed.deleted' : 'sessions.closed.description'}
        branch={branch}
        newSession={<Link to="/sessions/new" />}
        {...(session.isResolved
          ? {}
          : { onRestart: () => restart.mutate(session.id), restarting: restart.isPending })}
      />
    );
  }

  return (
    /* The artboard frames the terminal rather than bleeding it: 14px of canvas
       around a 1040px card, so mono output keeps a readable measure on a wide
       display. The frame has **no radius** (`SessionsConsole.dc.html` sets
       `border-radius: 0`): rounded, it reads as a widget tucked into a card
       rather than the console surface `terminal.css` asks for. It is the
       terminal's colour, as the artboard's is, so frame and pane read as one
       surface in dark mode. */
    <div className="flex min-h-0 flex-1 flex-col bg-term-bg p-3.5">
      <div className="mx-auto flex min-h-0 w-full max-w-260 flex-1 flex-col overflow-hidden">
        <SessionTerminal sessionId={session.id} hostId={session.hostId} />
      </div>
    </div>
  );
}
