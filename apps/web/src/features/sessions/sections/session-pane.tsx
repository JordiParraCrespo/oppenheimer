import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import {
  useRestartSession,
  useSessionOpening,
  useSuspenseSession,
} from '@oppenheimer/frontend-consumer/react';
import { useDeploymentCapabilities, useFeatureFlag } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { lazy, type ReactNode, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatViewToggle } from '../components/chat-view-toggle';
import { PreviewToggle } from '../components/preview-toggle';
import { SessionClosed } from '../components/session-closed';
import { useChatReading, useSessionChat } from '../hooks/use-session-chat';
import type { PaneReading, SessionView } from '../lib/chat-blocks';
import { createFileHandOff } from '../lib/file-hand-off';
import { type PreviewTab, rememberPreviewOpen, storedPreviewOpen } from '../lib/preview-open';
import { LatencyReadout } from './latency-readout';
import { SessionBar } from './session-bar';
import { SessionChat } from './session-chat';
import { SessionCloud } from './session-cloud';
import { SessionProvisioning } from './session-provisioning';
import { SessionShareButton } from './session-share-button';

/**
 * The preview pane loads when first opened: the session pane is the console's
 * first load, and most readers never open the pane.
 */
const SessionPreview = lazy(() =>
  import('./session-preview').then((module) => ({ default: module.SessionPreview })),
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
  initialView = 'terminal',
  closed,
  bar,
  terminal,
}: {
  sessionId: string;
  /**
   * The view the pane opens on. Chat is drawn only once the host sends the
   * agent's transcript, so a pane that opens on it shows the terminal until
   * then, and the chat the moment it can.
   */
  initialView?: SessionView;
  /**
   * The live terminal, once the session has one: the screen composes it, with
   * whatever its status bar carries. `reading` is the session's chat and how
   * the pane reads it, held here because the chat is a view of its own, beside the terminal rather than inside it:
   * the terminal feeds it and draws it over its grid as `cover`. `status` is
   * what the terminal's status line carries beside the link: the view switch
   * and Share when there is no bar to hold them, else nothing.
   */
  terminal: (session: SessionEntity, reading: PaneReading, status: ReactNode) => ReactNode;
  /** Present: the pane draws the session's bar, led by `back` ("Back to task"). */
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
  const [view, setView] = useState<SessionView>(initialView);
  // The preview pane beside the terminal: its toggle is in the bar, the pane
  // in the row under it, so the one state both read lives here.
  // Which of the pane's views this console and deployment can show: the
  // Browser needs a preview domain, the Simulator only its flag.
  const { data: deployment } = useDeploymentCapabilities();
  const browserOffered =
    useFeatureFlag('session_browser_preview') && Boolean(deployment?.session_previews);
  const simulatorOffered = useFeatureFlag('session_device_preview');
  const previewTabs: PreviewTab[] = [
    ...(browserOffered ? (['browser'] as const) : []),
    ...(simulatorOffered ? (['simulator'] as const) : []),
  ];
  const previewOffered = previewTabs.length > 0 && Boolean(bar);
  const [previewOpen, setPreviewOpen] = useState(storedPreviewOpen);
  const togglePreview = (open: boolean) => {
    setPreviewOpen(open);
    rememberPreviewOpen(open);
  };
  const chat = useSessionChat();
  // Made once: the terminal delivers the files it catches over the chat, the
  // chat's composer takes them.
  const [files] = useState(createFileHandOff);
  const reading: PaneReading = {
    chat,
    view,
    onViewChange: setView,
    cover: <SessionChat chat={chat} readOnly={false} attach={{ sessionId, files }} />,
    files,
  };
  // Whether the transcript has come, so the view switch is offered.
  const { offered: chatOffered } = useChatReading(reading);
  const { data: session, error } = useSuspenseSession(sessionId);
  // The way back from a stopped session. Held here because this screen is the
  // one that branches on the lifecycle; the pane below it takes props only.
  const restart = useRestartSession();
  // A start watched here stays on its pane until the agent is running, not
  // just until the host made the terminal it will run in.
  const opening = useSessionOpening(session);

  // The view switch and Share have one home, decided here once: the session's
  // bar when the route lets this pane draw one, else the terminal's status
  // line. Nothing below chooses again; each place takes what it is handed.
  const viewToggle = chatOffered ? <ChatViewToggle view={view} onViewChange={setView} /> : null;
  const { head, statusItems } = bar
    ? {
        head: (
          <SessionBar
            session={session}
            back={bar.back}
            tabs={session.isLive ? viewToggle : null}
            preview={
              session.isLive && previewOffered ? (
                <PreviewToggle open={previewOpen} onToggle={() => togglePreview(!previewOpen)} />
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
            <LatencyReadout sessionId={session.id} />
            {viewToggle}
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

  // The **lifecycle** decides which pane this is, never the derived group: the
  // group is organised by what needs you, so an `idle` session has a live PTY
  // and a `waiting-on-you` one may be a terminal or a failure. What the pane
  // turns on is whether a terminal exists to attach to.
  // A cloud session the host has started is on claude.ai/code from then on:
  // no terminal to attach to, so it never reaches the panes below.
  if (
    session.isCloud &&
    session.cloudSessionId &&
    session.lifecycle !== 'failed' &&
    !session.isResolved
  ) {
    return (
      <>
        {alert}
        <SessionCloud session={session} />
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
    /* The terminal runs from the bar to the pane's foot with no frame around
       it (the 2026-10-25 export dropped the 14px of canvas). Its grid stands
       in the session's 1040px `TerminalColumn` so mono output keeps a readable
       measure on a wide display; the ground either side is the terminal's
       colour, so column and pane read as one surface. Read as a chat it is
       the same colour: the chat's ground is the terminal's (`--chat-ground`),
       so switching views changes what is drawn and never the pane's colour or
       the bar's, and the chat scrolls the whole pane at the grid's measure. */
    <>
      {head}
      {/* The terminal's column, and beside it the preview pane when it is
          open (`SessionsConsole.dc.html`): a row, so the terminal keeps the
          width the pane leaves it. */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-term-bg">
          {terminal(session, reading, statusItems)}
        </div>
        {previewOffered && previewOpen ? (
          <Suspense fallback={null}>
            <SessionPreview
              sessionId={session.id}
              offered={previewTabs}
              onClose={() => togglePreview(false)}
            />
          </Suspense>
        ) : null}
      </div>
    </>
  );
}
