import { Button, EmptyState, Skeleton } from '@oppenheimer/design-system-web';
import { CircleOff, Terminal } from '@oppenheimer/design-system-web/icons';
import { useSession } from '@oppenheimer/frontend-consumer/react';
import { RouteError, RouteNotFound } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { isSessionNotFound } from '../lib/session-error';
import { SessionProvisioning } from '../sections/session-provisioning';
import { SessionTerminal } from '../sections/session-terminal';

/**
 * One session, in whichever of its states the URL lands on.
 *
 * The screen is the branch point because the branch *is* the route: a session
 * id resolves to a terminal, to a pane watching a host start one, to a
 * finished session, or to nothing at all. Each branch is somebody's bookmark,
 * so each answers on its own rather than the terminal opening over a session
 * that has no PTY behind it.
 *
 * The query is subscribed to here and read by every branch below, which is the
 * shared-result case: the pane, its heading and its clock are all this one
 * session.
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

  if (!session.isLive) return <SessionClosed name={session.name} />;

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
      <div className="mx-auto flex min-h-0 w-full max-w-[1040px] flex-1 flex-col overflow-hidden">
        <SessionTerminal sessionId={session.id} />
      </div>
    </div>
  );
}

/** The pane's shape while the session is being read, at the size it will be. */
function SessionSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-3.5">
      <Skeleton className="mx-auto min-h-0 w-full max-w-[1040px] flex-1 rounded-none" />
    </div>
  );
}

/**
 * A session whose terminal is gone: stopped, or closed from another tab. The
 * work is on its branch, which is what the reader wants to hear — there is no
 * reattaching to a tmux session that has exited.
 */
function SessionClosed({ name }: { name: string }) {
  const { t } = useTranslation();

  return (
    <EmptyState className="my-auto">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <CircleOff />
        </EmptyState.Media>
        <EmptyState.Title>{name}</EmptyState.Title>
        <EmptyState.Description>{t('sessions.closed.description')}</EmptyState.Description>
      </EmptyState.Header>
      <EmptyState.Content>
        <Button variant="secondary" render={<Link to="/sessions/new" />}>
          <Terminal />
          {t('nav.newSession')}
        </Button>
      </EmptyState.Content>
    </EmptyState>
  );
}
