import {
  Button,
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
import { TimeAway } from '../components/time-away';
import { useFilePaste } from '../hooks/use-file-paste';
import { useSessionRefresh } from '../hooks/use-session-refresh';
import { useTerminal } from '../hooks/use-terminal';
import { hostLinkLabels } from '../lib/host-link-labels';
import { hostLinkPhaseOf } from '../lib/host-link-phase';
import { AGENT_WINDOW, terminalKey } from '../lib/terminal-pool';
import { HostLinkFix } from './host-link-fix';

/**
 * The session's terminal: the scrollback and the status band. No window
 * strip; the design system's tab CSS waits for several windows, a later slice.
 *
 * Files dropped anywhere on the pane go the way pasted files do: the
 * `DropZone` around the terminal outlines the pane while the drag is over it
 * and hands the drop to the same batch upload as a paste (`useFilePaste`),
 * whose paths land in the agent's prompt.
 *
 * The bottom band is the host link (`HostLinkChrome`): the status bar while
 * the link is live or blipping, and while the host is away a banner in its
 * place that says so, counts the time, and opens the fix from How to fix.
 * It comes back on its own; the fix is for when it does not.
 *
 * **There is no prompt row of ours.** The artboard draws one, but a real
 * agent draws its own prompt inside the grid, and a second field gave the pane
 * two carets; the agent's has the history, slash commands and mode, so the
 * grid keeps the input.
 */
export function SessionTerminal({
  sessionId,
  hostId,
  statusItem,
}: {
  sessionId: string;
  hostId: string;
  /** Drawn first in the status bar: the session's task, when the route has one. */
  statusItem?: ReactNode;
}) {
  const { t } = useTranslation();
  const createStream = useSessionStream(sessionId, AGENT_WINDOW);
  const refresh = useSessionRefresh(sessionId);
  const upload = useFilePaste(sessionId, AGENT_WINDOW);
  const terminal = useTerminal(terminalKey(sessionId, AGENT_WINDOW), createStream, {
    onEnd: refresh,
    agentWindow: true,
    onFiles: upload.send,
    hostId,
  });
  const { containerRef, status, hasOutput, ended, retryNow, awaySince } = terminal;
  const phase = hostLinkPhaseOf({
    status,
    away: awaySince !== null,
    reconnected: terminal.reconnected,
  });
  const host = terminal.hostName ?? t('sessions.session.hostLink.thisHost');

  return (
    <DropZone onFiles={upload.send} className="flex min-h-0 flex-1 flex-col">
      <Terminal
        className="min-h-0 flex-1 overflow-hidden"
        hostLink={phase ? { phase, host, labels: hostLinkLabels(t) } : undefined}
      >
        {/* The padding is the wrapper's: the fit addon sizes the grid from its
          host element and counts that host's padding as usable space, so a
          padded host overflows its own box and paints over the rows below it.
          xterm owns everything inside the inner element, scrollbar included. */}
        <div className="relative min-h-0 flex-1 overflow-hidden px-5 py-4">
          <div ref={containerRef} className="size-full" />
          {/* A live link with an empty grid behind it: a new session whose agent
            has not drawn yet (the provisioning pane has handed over), or an
            older one replaying its scrollback. Either way the reader cannot
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
          >
            {statusItem}
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
          </HostLinkChrome>
        ) : (
          <TerminalStatusBar>
            {statusItem}
            <TerminalStatusItem>{t('sessions.session.status.closed')}</TerminalStatusItem>
          </TerminalStatusBar>
        )}
      </Terminal>
    </DropZone>
  );
}
