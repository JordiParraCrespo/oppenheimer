import {
  Button,
  cn,
  DropZone,
  EmptyState,
  HostLinkChrome,
  Terminal,
  TerminalStatusBar,
  TerminalStatusItem,
} from '@oppenheimer/design-system-web';
import { useSessionStream } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatCover } from '../components/chat-cover';
import { TimeAway } from '../components/time-away';
import { useFilePaste } from '../hooks/use-file-paste';
import { useChatReading } from '../hooks/use-session-chat';
import { useSessionRefresh } from '../hooks/use-session-refresh';
import { useTerminal } from '../hooks/use-terminal';
import type { PaneReading } from '../lib/chat-blocks';
import { hostLinkLabels } from '../lib/host-link-labels';
import { hostLinkPhaseOf } from '../lib/host-link-phase';
import { takeFilePaste } from '../lib/terminal-files';
import { HostLinkFix } from './host-link-fix';

/** Window 0 is the agent's (05); the pane shows only that one today. */
const AGENT_WINDOW = 0;

/**
 * The session's terminal: the scrollback and the status band. No window
 * strip; the design system's tab CSS waits for several windows, a later slice.
 *
 * Files dropped anywhere on the pane go the way pasted files do: the
 * `DropZone` around the terminal outlines the pane while the drag is over it
 * and hands the drop to the same batch upload as a paste (`useFilePaste`),
 * whose paths land in the agent's prompt. While the chat shows and its
 * composer takes files (`reading.files`), a drop or a paste goes there
 * instead, a chip on the next message, since the prompt they would land in
 * is out of sight under the chat.
 *
 * The bottom band is the host link (`HostLinkChrome`): the status bar while
 * the link is live or blipping (without the link while it is live when the
 * session's bar above already says its state, `showLive` off), and while the host is away a banner in its
 * place that says so, counts the time, and opens the fix from How to fix.
 * It comes back on its own; the fix is for when it does not. What else the
 * line carries is the pane's (`statusItems`): nothing when the session has a bar
 * of its own, the view switch and Share when it does not.
 *
 * **Chat** (0.7, behind `session_chat_view`): the pane hands in a chat
 * (`reading`). This stream feeds it and lends it its input, and once the host
 * sends the agent's transcript the status bar offers Terminal / Chat; Chat
 * draws the pane's `cover` over the grid, which stays mounted under it at its
 * size, so tmux is never resized. What the cover is, is the pane's: this
 * section owns the terminal and only makes room, and takes the files pasted
 * on it as it takes the grid's. While it shows, the terminal
 * paints no ground of its own, so its status bar sits on the cover's.
 *
 * **There is no prompt row of ours.** The artboard draws one, but a real
 * agent draws its own prompt inside the grid, and a second field gave the pane
 * two carets; the agent's has the history, slash commands and mode, so the
 * grid keeps the input. A pull request's review session is the same pane.
 */
export function SessionTerminal({
  sessionId,
  hostId,
  statusItems,
  showLive = true,
  reading,
}: {
  sessionId: string;
  hostId: string;
  /** The chat this terminal feeds, and how the pane around it reads it. */
  reading: PaneReading;
  /** What the status line carries beside the link, from the pane. */
  statusItems?: ReactNode;
  /** Say Live while the link holds; off under a bar that says the session's state. */
  showLive?: boolean;
}) {
  const { t } = useTranslation();
  const createStream = useSessionStream(sessionId, AGENT_WINDOW);
  const refresh = useSessionRefresh(sessionId);
  const upload = useFilePaste(sessionId, AGENT_WINDOW);
  const { chat, cover } = reading;
  const { shown: chatShown } = useChatReading(reading);
  const takeFiles = chatShown && reading.files ? reading.files.deliver : upload.send;
  const terminal = useTerminal(createStream, {
    chat,
    onEnd: refresh,
    agentWindow: true,
    onFiles: upload.send,
    hostId,
    snapshotKey: `${sessionId}:${AGENT_WINDOW}`,
    latencyKey: sessionId,
  });
  const { containerRef, status, hasOutput, ended, retryNow, awaySince } = terminal;
  const phase = hostLinkPhaseOf({
    status,
    away: awaySince !== null,
    reconnected: terminal.reconnected,
    slow: terminal.slowDial,
  });
  const host = terminal.hostName ?? t('sessions.session.hostLink.thisHost');

  return (
    <DropZone onFiles={takeFiles} className="flex min-h-0 flex-1 flex-col">
      <Terminal
        className={cn('min-h-0 flex-1 overflow-hidden', chatShown && 'bg-transparent')}
        hostLink={phase ? { phase, host, labels: hostLinkLabels(t) } : undefined}
      >
        {/* The padding is the column's: the fit addon sizes the grid from its
          host element and counts that host's padding as usable space, so a
          padded host overflows its own box and paints over the rows below it.
          xterm owns everything inside the inner element, scrollbar included.
          The grid keeps a 1040px column so mono output has a readable measure
          on a wide display; the covers below take the whole width, so the
          chat's scrollbar sits at the pane's edge. */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="mx-auto size-full max-w-260 px-5 py-4">
            {/* `isolate` keeps xterm's own layers (its helpers, the typeahead,
              each with a z-index) inside the grid, so the covers below paint
              over all of them rather than under some. */}
            <div ref={containerRef} className="isolate size-full" />
          </div>
          {/* A live link with an empty grid behind it: a new session whose agent
            has not drawn yet (the provisioning pane has handed over), or an
            older one replaying its scrollback that this tab has no kept
            picture of (`terminal-snapshots.ts`). Either way the reader cannot
            tell a slow start from a broken session without this. It covers
            the grid rather than replacing it, so the terminal stays mounted
            and keeps its size, and the first glyph takes it away. */}
          {status === 'live' && !hasOutput ? (
            <div className="absolute inset-0 flex items-center justify-center bg-term-bg">
              <EmptyState>
                <EmptyState.Header>
                  <EmptyState.Title>{t('sessions.session.starting.title')}</EmptyState.Title>
                  <EmptyState.Description>
                    {t('sessions.session.starting.description')}
                  </EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            </div>
          ) : null}
          {chatShown ? (
            // Typing in the chat moves focus off the grid, so a paste there
            // never reaches the grid's listener: the cover takes its files
            // for the chat's composer. On the way down, as the grid does, so
            // nothing in the chat can swallow it.
            <ChatCover onPasteCapture={(event) => takeFilePaste(event, takeFiles)}>
              {cover}
            </ChatCover>
          ) : null}
        </div>

        {/* An end the refetch will not explain: the session is still live, but
          this reader was refused its terminal. Say why, and let them try
          again rather than sit on "Disconnected". */}
        {ended === 'forbidden' || ended === 'refused' ? (
          <div className="px-5 pb-3">
            <ErrorAlert
              message={t(`sessions.session.ended.${ended}`)}
              action={
                <Button variant="ghost" size="sm" onClick={retryNow}>
                  {t('sessions.session.retry')}
                </Button>
              }
            />
          </div>
        ) : null}

        {upload.failure || upload.refused ? (
          <div className="px-5 pb-3">
            {upload.refused ? (
              <ErrorAlert
                message={t('sessions.session.file.notSupported')}
                title={t('sessions.session.file.failedTitle')}
                onDismiss={upload.dismiss}
              />
            ) : (
              <ErrorAlert
                error={upload.failure}
                fallback={t('errors.fallback')}
                title={t('sessions.session.file.failedTitle')}
                onDismiss={upload.dismiss}
              />
            )}
          </div>
        ) : null}

        {phase ? (
          <HostLinkChrome
            elapsed={
              phase === 'offline' && awaySince !== null ? (
                <TimeAway since={new Date(awaySince)} />
              ) : undefined
            }
            fix={<HostLinkFix host={host} />}
            showLive={showLive}
          >
            {/* Between reconnects the ladder may be waiting up to thirty
                seconds; this skips the wait. Not while the host is away: the
                banner says it comes back on its own, and it does. */}
            {phase === 'reconnecting' ? (
              <Button variant="ghost" size="xs" onClick={retryNow}>
                {t('sessions.session.retryNow')}
              </Button>
            ) : null}
            {upload.sending ? (
              <TerminalStatusItem>{t('sessions.session.file.sending')}</TerminalStatusItem>
            ) : null}
            {/* The artboard's other items — context used, rate-limit windows,
                memory, permission mode, host count — are numbers the runner
                and the control plane report. They stay out until there is
                something real to put in them. */}
            {statusItems}
          </HostLinkChrome>
        ) : (
          <TerminalStatusBar>
            <TerminalStatusItem>{t('sessions.session.status.closed')}</TerminalStatusItem>
            {statusItems}
          </TerminalStatusBar>
        )}
      </Terminal>
    </DropZone>
  );
}
