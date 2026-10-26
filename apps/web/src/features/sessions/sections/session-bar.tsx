import { StatusDot } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { PageBar } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLatencyReadout } from '../hooks/use-latency-readout';
import { dotFor, stateWordFor } from '../lib/session-run-state';
import { SessionShareButton } from './session-share-button';

/**
 * A session's bar (`SessionsConsole.dc.html`, the 2026-10-25 export): the
 * sidebar toggle, the task it came from when there is one, the session's
 * name and its state on a dot, then the view switch and Share on the right.
 * It is the page's bar, not a band inside the terminal, so the terminal under
 * it runs to the pane's edges and its own status line keeps only the link.
 *
 * With the echo readout switched on (`latency-readout.ts`), the terminal's
 * keystroke round trip sits after the state, in the bar rather than over
 * the grid.
 *
 * Every state of the session draws it — starting, live, stopped — so the way
 * back to the sidebar never moves. The preview the frame opens beside a
 * session (a browser, a phone simulator) is not built, so it has no button.
 */
export function SessionBar({
  session,
  back,
  tabs,
}: {
  session: SessionEntity;
  /** "Back to task", when the route has one. */
  back?: ReactNode;
  /** Terminal / Chat, once the chat is offered. */
  tabs?: ReactNode;
}) {
  const { t } = useTranslation();
  const dot = dotFor(session);
  const latency = useLatencyReadout(session.id);
  return (
    <PageBar
      leading={back}
      title={session.name}
      // Beside the name, as the frame draws it, rather than at the far end.
      meta={
        <>
          <StatusDot
            state={dot}
            density="compact"
            pulse={dot === 'pending'}
            className="shrink-0 text-xs text-fg-muted"
          >
            {t(`sessions.session.state.${stateWordFor(session)}`)}
          </StatusDot>
          {latency ? (
            <span
              aria-hidden="true"
              data-testid="terminal-latency"
              className="shrink-0 truncate font-mono text-xs text-fg-muted tabular-nums"
            >
              {latency}
            </span>
          ) : null}
        </>
      }
      tabs={tabs}
      actions={<SessionShareButton sessionId={session.id} />}
      // On the terminal's ground with a hairline under it, whichever view is
      // on screen: the chat stands on the same ground, so bar, grid and chat
      // read as one surface and switching views changes no colour.
      className="border-b border-border-subtle bg-term-bg"
    />
  );
}
