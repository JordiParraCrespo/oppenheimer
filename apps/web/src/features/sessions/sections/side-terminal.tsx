import {
  Button,
  DropZone,
  EmptyState,
  HostLinkChrome,
  Terminal,
} from '@oppenheimer/design-system-web';
import { useSessionStream } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { TimeAway } from '../components/time-away';
import { useFilePaste } from '../hooks/use-file-paste';
import { useTerminal } from '../hooks/use-terminal';
import { hostLinkLabels } from '../lib/host-link-labels';
import { hostLinkPhaseOf } from '../lib/host-link-phase';
import { HostLinkFix } from './host-link-fix';

/**
 * One of the session's shells in the side pane: tmux window `window` (1 and
 * up; 0 is the agent's), in the session's worktree, streamed over the same
 * attach socket as the agent's terminal. A plain shell has no chat to read;
 * a file dropped or pasted on it lands at its prompt, as on the agent's. The grid takes the pane's whole width: the pane is
 * narrower than the session's column already.
 */
export function SideTerminal({
  sessionId,
  hostId,
  window,
}: {
  sessionId: string;
  hostId: string;
  window: number;
}) {
  const { t } = useTranslation();
  const createStream = useSessionStream(sessionId, window);
  const upload = useFilePaste(sessionId, window);
  const terminal = useTerminal(createStream, {
    onFiles: upload.send,
    hostId,
    snapshotKey: `${sessionId}:${window}`,
  });
  const { containerRef, status, ended, retryNow, awaySince } = terminal;
  const phase = hostLinkPhaseOf({
    status,
    away: awaySince !== null,
    reconnected: terminal.reconnected,
    slow: terminal.slowDial,
  });
  const host = terminal.hostName ?? t('sessions.session.hostLink.thisHost');

  // The window was closed under this tab (from the host, or `exit` in the
  // shell): there is nothing to attach to any more.
  if (ended === 'missing') {
    return (
      <EmptyState className="flex-1">
        <EmptyState.Header>
          <EmptyState.Title>{t('sessions.side.terminal.gone')}</EmptyState.Title>
        </EmptyState.Header>
      </EmptyState>
    );
  }

  return (
    <DropZone onFiles={upload.send} className="flex min-h-0 flex-1 flex-col bg-term-bg">
      <Terminal
        className="min-h-0 flex-1 overflow-hidden"
        hostLink={phase ? { phase, host, labels: hostLinkLabels(t) } : undefined}
      >
        {/* The padding is the wrapper's, not the grid host's: the fit addon
            counts its host's padding as usable space. */}
        <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
          <div ref={containerRef} className="isolate size-full" />
        </div>
        {ended === 'forbidden' || ended === 'refused' ? (
          <div className="px-3 pb-3">
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
        {upload.failure ? (
          <div className="px-3 pb-3">
            <ErrorAlert
              error={upload.failure}
              fallback={t('errors.fallback')}
              title={t('sessions.session.file.failedTitle')}
              onDismiss={upload.dismiss}
            />
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
            showLive={false}
          >
            {phase === 'reconnecting' ? (
              <Button variant="ghost" size="xs" onClick={retryNow}>
                {t('sessions.session.retryNow')}
              </Button>
            ) : null}
          </HostLinkChrome>
        ) : null}
      </Terminal>
    </DropZone>
  );
}
