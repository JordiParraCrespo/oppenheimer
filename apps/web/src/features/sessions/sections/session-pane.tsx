import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useSessionOpening, useSuspenseSession } from '@oppenheimer/frontend-consumer/react';
import { useDeploymentCapabilities, useFeatureFlag } from '@oppenheimer/frontend-core/react';
import { ErrorAlert, PageBar } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { lazy, type ReactNode, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatViewIcons } from '../components/chat-view-icons';
import { ChatViewToggle } from '../components/chat-view-toggle';
import { CloudSessionAway } from '../components/cloud-session-away';
import { PreviewFrame } from '../components/preview-frame';
import { PreviewToggle } from '../components/preview-toggle';
import { SessionClosed } from '../components/session-closed';
import { usePreviewPane } from '../hooks/use-preview-pane';
import { useReadOnOpen } from '../hooks/use-read-on-open';
import { useRestartOnOpen } from '../hooks/use-restart-on-open';
import { useChatReading, useSessionChat } from '../hooks/use-session-chat';
import { useClearUnreadOnOpen } from '../hooks/use-session-unread';
import { DEFAULT_SESSION_VIEW, type PaneReading, type SessionView } from '../lib/chat-blocks';
import { createFileHandOff } from '../lib/file-hand-off';
import type { PreviewTab } from '../lib/preview-open';
import { SessionBar } from './session-bar';
import { SessionChat } from './session-chat';
import { SessionCloud } from './session-cloud';
import { SessionCloudChat } from './session-cloud-chat';
import { SessionProvisioning } from './session-provisioning';
import { SessionShareButton } from './session-share-button';

/**
 * The side pane loads when first opened: the session pane is the console's
 * first load, and most readers never open the pane.
 */
const SessionSidePane = lazy(() =>
  import('./session-side-pane').then((module) => ({ default: module.SessionSidePane })),
);

/**
 * One session once it has answered, in `SessionScreen`'s `QueryState.Data`:
 * a terminal, a pane watching a host start one, or a finished session. Each
 * is somebody's bookmark, so each answers on its own rather than a terminal
 * opening over a session with no PTY. The session is read here, under
 * Suspense, and shared by every branch. A refetch that fails is said beside
 * a pane that is not the terminal; the terminal streams on its own link and
 * says what that link is doing itself.
 *
 * With `bar`, the route draws no bar of its own (`staticData.bar: 'own'`) and
 * this pane draws the session's (`SessionBar`) over every branch, with the
 * view switch and Share in it. Without one (a pull request's review session,
 * under the pull request's toolbar), those two close the terminal's status
 * line instead.
 */
export function SessionPane({
  sessionId,
  restartOnOpen = false,
  readOnOpen = true,
  closed,
  bar,
  terminal,
  side,
}: {
  sessionId: string;
  /**
   * Restart a session that is stopped when the pane opens. The caller
   * decides: the session's own page does, the side pane (which a stored
   * layout reopens beside another session) and a run's own stopped pane do
   * not.
   */
  restartOnOpen?: boolean;
  /**
   * Whether drawing the pane reads the session's finished turn (its blue
   * dot goes). On by default; off where that unread turn is what the pane is
   * shown for (an Inbox card), so opening it does not take the card away.
   */
  readOnOpen?: boolean;
  /**
   * The live terminal, once the session has one: the screen composes it, with
   * whatever its status bar carries. `reading` is the session's chat and how
   * the pane reads it, held here because the chat is a view of its own, beside the terminal rather than inside it:
   * the terminal feeds it and draws it over its grid as `cover`. `status` is
   * what the terminal's status line carries beside the link: the view switch
   * and Share when there is no bar to hold them, else nothing.
   */
  terminal: (session: SessionEntity, reading: PaneReading, status: ReactNode) => ReactNode;
  /**
   * Present: the pane draws the session's bar, led by `back` ("Back to task"),
   * with the open tabs (`open`) for its title under Sessions.
   */
  bar?: { back?: ReactNode; open?: ReactNode };
  /**
   * What the side pane draws for another session and for a bot's chat, from
   * the screen: the first is this pane, which cannot import itself, the second
   * the bots feature's. Absent, there is no side pane (a session opened in
   * another's side pane has none of its own).
   */
  side?: { session: (sessionId: string) => ReactNode; bot?: (botId: string) => ReactNode };
  /**
   * What to draw instead of the session's own stopped pane.
   *
   * A run opened from the automations list is the same terminal and a
   * different thing to say about it: a run's turn ended and its session did
   * not, and the way back in is **Open in terminal**, not Restart, with no
   * New session under it. The route composes the two — the terminal is this
   * feature's, the run's vocabulary is the automations feature's, and
   * neither imports the other.
   */
  closed?: (session: {
    name: string;
    branch: string | null;
    restart: () => void;
    restarting: boolean;
  }) => ReactNode;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<SessionView>(DEFAULT_SESSION_VIEW);
  // The side pane beside the terminal: its toggle is in the bar, the pane in
  // the row under it, so the one state both read lives here.
  // Which previews this console and deployment can show in it: the Browser
  // needs a preview domain, the Simulator only its flag, the Desktop its flag
  // and a host (a cloud session has none).
  const { data: deployment } = useDeploymentCapabilities();
  const browserOffered =
    useFeatureFlag('session_browser_preview') && Boolean(deployment?.session_previews);
  const simulatorOffered = useFeatureFlag('session_device_preview');
  const desktopFlag = useFeatureFlag('host_desktop');
  const preview = usePreviewPane();
  const chat = useSessionChat(sessionId);
  // Made once: the terminal delivers the files it catches over the chat, the
  // chat's composer takes them.
  const [files] = useState(createFileHandOff);
  const { data: session, error } = useSuspenseSession(sessionId);
  // Opening a session reads what its last turn left: its blue dot goes.
  useReadOnOpen(session, readOnOpen);
  // Nor the reader's own Mark as unread, where the turn is kept unread.
  useClearUnreadOnOpen(sessionId, readOnOpen);
  const previewTabs: PreviewTab[] = [
    ...(browserOffered ? (['browser'] as const) : []),
    ...(simulatorOffered ? (['simulator'] as const) : []),
    ...(desktopFlag && session.hostId ? (['desktop'] as const) : []),
  ];
  const sideOffered = Boolean(bar && side);
  const reading: PaneReading = {
    chat,
    view,
    onViewChange: setView,
    cover: (
      <SessionChat
        chat={chat}
        agent={session.agent}
        readOnly={false}
        attach={{ sessionId, files }}
        onOpenTerminal={() => setView('terminal')}
      />
    ),
    files,
  };
  // Whether the transcript has come, so the view switch is offered.
  const { offered: chatOffered } = useChatReading(reading);
  // The way back from a stopped session. Held here because this screen is the
  // one that branches on the lifecycle; the pane below it takes props only.
  const comeback = useRestartOnOpen(session, restartOnOpen);
  const restarting = comeback.status.kind === 'restarting';
  // A start watched here stays on its pane until the agent is running, not
  // just until the host made the terminal it will run in.
  const opening = useSessionOpening(session);

  // The view switch and Share have one home, decided here once: the session's
  // bar when the route lets this pane draw one, else the terminal's status
  // line. Nothing below chooses again; each place takes what it is handed.
  const { head, statusItems } = bar
    ? {
        head: (
          <SessionBar
            session={session}
            back={bar.back}
            open={bar.open}
            tabs={
              session.isLive && chatOffered ? (
                <ChatViewIcons view={view} onViewChange={setView} />
              ) : null
            }
            preview={
              session.isLive && sideOffered ? (
                <PreviewToggle open={preview.open} onToggle={() => preview.toggle(!preview.open)} />
              ) : null
            }
          />
        ),
        statusItems: null,
      }
    : {
        head: null,
        statusItems: (
          <>
            {chatOffered ? <ChatViewToggle view={view} onViewChange={setView} /> : null}
            <SessionShareButton sessionId={session.id} place="status" />
          </>
        ),
      };
  const alert = (
    <>
      {head}
      <ErrorAlert error={error} fallback={t('sessions.screen.loadFailed')} />
    </>
  );

  // A cloud session launched at its vendor has no host and no terminal of
  // ours to attach to or start: it is followed at the vendor. Its bar is its
  // name alone, with none of a host session's Share.
  if (session.cloud) {
    return (
      <>
        {bar ? (
          <PageBar title={bar.open ?? session.name} tone={bar.open ? 'chrome' : 'page'} />
        ) : null}
        <ErrorAlert error={error} fallback={t('sessions.screen.loadFailed')} />
        <CloudSessionAway session={session} />
      </>
    );
  }

  // The **lifecycle** decides which pane this is, never the derived group: the
  // group is organised by what needs you, so an `idle` session has a live PTY
  // and a `waiting-on-you` one may be a terminal or a failure. What the pane
  // turns on is whether a terminal exists to attach to.
  // A cloud session the host has started is at its vendor from then on
  // (claude.ai/code, chatgpt.com/codex): no terminal to attach to, so it never
  // reaches the panes below.
  if (
    session.isCloud &&
    session.cloudSessionId &&
    session.lifecycle !== 'failed' &&
    !session.isResolved
  ) {
    return (
      <>
        {alert}
        {session.agent === 'claude-code' ? (
          <SessionCloudChat session={session} />
        ) : (
          <SessionCloud session={session} />
        )}
      </>
    );
  }

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
            restart: comeback.restart,
            restarting,
          })}
        </>
      );
    }
    return (
      <>
        {alert}
        {comeback.status.kind === 'timed-out' ? (
          <ErrorAlert message={t('sessions.closed.restartFailed')} />
        ) : comeback.status.kind === 'failed' ? (
          <ErrorAlert error={comeback.status.error} fallback={t('sessions.closed.restartFailed')} />
        ) : null}
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
          {...(session.isResolved ? {} : { onRestart: comeback.restart, restarting })}
        />
      </>
    );
  }

  return (
    /* The terminal runs from the bar to the pane's foot with no frame around
       it (the 2026-10-25 export dropped the 14px of canvas). Its grid stands
       in the session's 760px `TerminalColumn` so mono output keeps a readable
       measure on a wide display; the ground either side is the terminal's
       colour, so column and pane read as one surface. Read as a chat it is
       the same colour: the chat's ground is the terminal's (`--chat-ground`),
       so switching views changes what is drawn and never the pane's colour or
       the bar's, and the chat scrolls the whole pane at the grid's measure. */
    <>
      {head}
      {/* The terminal's column, and beside it the side pane when it is open
          (`SessionsConsole.dc.html`): a row, so the terminal keeps the width
          the pane leaves it. */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-term-bg">
          {terminal(session, reading, statusItems)}
        </div>
        {sideOffered && side ? (
          <PreviewFrame phase={preview.phase} onTransitionEnd={preview.onTransitionEnd}>
            <Suspense fallback={null}>
              <SessionSidePane
                sessionId={session.id}
                sessionEngine={{ agent: session.agent, ...session.launch }}
                hostId={session.hostId}
                previews={previewTabs}
                onClose={() => preview.toggle(false)}
                session={side.session}
                bot={side.bot}
              />
            </Suspense>
          </PreviewFrame>
        ) : null}
      </div>
    </>
  );
}
