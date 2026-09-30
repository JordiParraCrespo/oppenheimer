import {
  Button,
  EmptyState,
  Terminal,
  TerminalStatusBar,
  TerminalStatusItem,
} from '@oppenheimer/design-system-web';
import { useSessionStream } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useImagePaste } from '../hooks/use-image-paste';
import { useSessionRefresh } from '../hooks/use-session-refresh';
import { useTerminal } from '../hooks/use-terminal';

/** Window 0 is the agent's (05); the pane shows only that one today. */
const AGENT_WINDOW = 0;

/**
 * The session's terminal: the scrollback and the status band. No window
 * strip; the design system's tab CSS waits for several windows, a later slice.
 *
 * **There is no prompt row of ours.** The artboard draws one, but a real
 * agent draws its own prompt inside the grid, and a second field gave the pane
 * two carets; the agent's has the history, slash commands and mode, so the
 * grid keeps the input.
 *
 * **An image pasted or dropped onto the grid** goes to the host rather than
 * to xterm: the agent reads its host's clipboard, never the browser's, so the
 * runner saves the file and pastes its path into the prompt (05).
 */
export function SessionTerminal({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const createStream = useSessionStream(sessionId, AGENT_WINDOW);
  const refresh = useSessionRefresh(sessionId);
  const image = useImagePaste(sessionId, AGENT_WINDOW);
  const { containerRef, status, hasOutput, ended, retryNow } = useTerminal(createStream, {
    onEnd: refresh,
    agentWindow: true,
    onImage: image.onImage,
  });

  return (
    <Terminal className="min-h-0 flex-1 overflow-hidden">
      {/* The padding is the wrapper's: the fit addon sizes the grid from its
          host element and counts that host's padding as usable space, so a
          padded host overflows its own box and paints over the rows below it.
          xterm owns everything inside the inner element, scrollbar included. */}
      <div className="relative min-h-0 flex-1 overflow-hidden px-5 py-4">
        <div ref={containerRef} className="size-full" />
        {/* A live link with an empty grid behind it.
            Two things arrive here and the reader cannot tell them apart, which
            is why the copy names both. A new session: the host reports it
            "started" once tmux holds it, which is before the agent inside has
            drawn anything — a few seconds cold, tens of them on a loaded
            machine — and the provisioning pane has handed over by then. An
            older one: the attachment replays its scrollback, and on a busy
            host that took seconds here.
            Either way the question is "is this broken", and the answer is no.
            It covers the grid rather than replacing it, so the terminal stays
            mounted and keeps its size, and the first chunk that would put a
            glyph on it takes this away. */}
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

      {image.failure ? (
        <div className="px-5 pb-3">
          <ErrorAlert
            error={image.failure}
            fallback={t('errors.fallback')}
            title={t('sessions.session.image.failedTitle')}
            onDismiss={image.dismiss}
          />
        </div>
      ) : null}

      <TerminalStatusBar>
        <TerminalStatusItem>
          <span
            data-status={status}
            className="size-1.5 rounded-pill bg-term-dim data-[status=live]:bg-term-success data-[status=offline]:bg-term-warning"
          />
          {t(`sessions.session.status.${status}`)}
        </TerminalStatusItem>
        {/* Between reconnects the ladder may be waiting up to thirty seconds;
            this skips the wait. */}
        {status === 'connecting' || status === 'offline' ? (
          <Button variant="ghost" size="xs" onClick={retryNow}>
            {t('sessions.session.retryNow')}
          </Button>
        ) : null}
        {image.sending ? (
          <TerminalStatusItem>{t('sessions.session.image.sending')}</TerminalStatusItem>
        ) : null}
        {/* The artboard's other items — context used, rate-limit windows,
            memory, permission mode, host count — are numbers the runner and
            the control plane report. They stay out until there is something
            real to put in them, and the grid size is not one of them: how
            many columns the pane resolved to is our business, not the
            reader's. */}
      </TerminalStatusBar>
    </Terminal>
  );
}
