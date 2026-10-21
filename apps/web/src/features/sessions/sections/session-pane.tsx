import { cn } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import {
  useRestartSession,
  useSessionOpening,
  useSuspenseSession,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionClosed } from '../components/session-closed';
import type { SessionView } from '../lib/chat-blocks';
import { SessionProvisioning } from './session-provisioning';

/**
 * One session once it has answered, in `SessionScreen`'s `QueryState.Data`:
 * a terminal, a pane watching a host start one, or a finished session. Each
 * is somebody's bookmark, so each answers on its own rather than a terminal
 * opening over a session with no PTY. The session is read here, under
 * Suspense, and shared by every branch. A refetch that fails is said beside
 * a pane that is not the terminal; the terminal streams on its own link and
 * says what that link is doing itself.
 */
export function SessionPane({
  sessionId,
  closed,
  terminal,
}: {
  sessionId: string;
  /**
   * The live terminal, once the session has one: the screen composes it, with
   * whatever its status bar carries. `view` is how the pane reads it, held
   * here because the frame changes with it: the chat sits on the console's
   * own ground, the grid on the terminal's.
   */
  terminal: (
    session: SessionEntity,
    view: { view: SessionView; onViewChange: (view: SessionView) => void },
  ) => ReactNode;
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
  const [view, setView] = useState<SessionView>('terminal');
  const { data: session, error } = useSuspenseSession(sessionId);
  // The way back from a stopped session. Held here because this screen is the
  // one that branches on the lifecycle; the pane below it takes props only.
  const restart = useRestartSession();
  // A start watched here stays on its pane until the agent is running, not
  // just until the host made the terminal it will run in.
  const opening = useSessionOpening(session);

  const alert = <ErrorAlert error={error} fallback={t('sessions.screen.loadFailed')} />;

  // The **lifecycle** decides which pane this is, never the derived group: the
  // group is organised by what needs you, so an `idle` session has a live PTY
  // and a `waiting-on-you` one may be a terminal or a failure. What the pane
  // turns on is whether a terminal exists to attach to.
  if (session.isProvisioning || opening || session.lifecycle === 'failed') {
    return (
      <>
        {alert}
        <SessionProvisioning session={session} />
      </>
    );
  }

  if (!session.isLive) {
    // Resolved is a delete: the worktree went with it, so its copy does not
    // point at the branch, and there is nothing left to restart. A stopped
    // session still has everything — the worktree, the branch, and the agent's
    // own conversation — so it offers the way back.
    const branch = session.isResolved ? null : (session.cwdCheckout?.branch ?? null);
    if (closed) {
      return (
        <>
          {alert}
          {closed({
            name: session.name,
            branch,
            restart: () => restart.mutate(session.id),
            restarting: restart.isPending,
          })}
        </>
      );
    }
    return (
      <>
        {alert}
        <SessionClosed
          name={session.name}
          copy={
            session.isResolved
              ? session.isFolder
                ? 'sessions.closed.deletedFolder'
                : 'sessions.closed.deleted'
              : 'sessions.closed.description'
          }
          branch={branch}
          newSession={<Link to="/sessions/new" />}
          {...(session.isResolved
            ? {}
            : { onRestart: () => restart.mutate(session.id), restarting: restart.isPending })}
        />
      </>
    );
  }

  return (
    /* The artboard frames the terminal rather than bleeding it: 14px of canvas
       around a 1040px card, so mono output keeps a readable measure on a wide
       display. The frame has **no radius** (`SessionsConsole.dc.html` sets
       `border-radius: 0`): rounded, it reads as a widget tucked into a card
       rather than the console surface `terminal.css` asks for. It is the
       terminal's colour, as the artboard's is, so frame and pane read as one
       surface in dark mode. `data-pane-ground` asks the shell's page bar
       above it for the same colour. Read as a chat, the frame paints nothing:
       the chat, the bar and the frame are all the shell's own ground. */
    <div
      data-pane-ground={view}
      className={cn('flex min-h-0 flex-1 flex-col p-3.5', view === 'terminal' && 'bg-term-bg')}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-260 flex-1 flex-col overflow-hidden">
        {terminal(session, { view, onViewChange: setView })}
      </div>
    </div>
  );
}
