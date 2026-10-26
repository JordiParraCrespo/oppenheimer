import { StatusDot } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { PageBar } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { dotFor, stateWordFor } from '../lib/session-run-state';
import { SessionShareButton } from './session-share-button';

/**
 * A session's bar (`SessionsConsole.dc.html`, the 2026-10-25 export): the
 * sidebar toggle, the task it came from when there is one, the session's
 * name and its state on a dot, then the view switch and Share on the right.
 * It is the page's bar, not a band inside the terminal, so the terminal under
 * it runs to the pane's edges and its own status line keeps only the link.
 *
 * Every state of the session draws it — starting, live, stopped — so the way
 * back to the sidebar never moves. `preview` is the toggle for the pane the
 * frame opens beside a session; of its two tabs only the Simulator is built.
 */
export function SessionBar({
  session,
  back,
  tabs,
  preview,
}: {
  session: SessionEntity;
  /** "Back to task", when the route has one. */
  back?: ReactNode;
  /** Terminal / Chat, once the chat is offered. */
  tabs?: ReactNode;
  /** The preview pane's toggle, while the session is live. */
  preview?: ReactNode;
}) {
  const { t } = useTranslation();
  const dot = dotFor(session);
  return (
    <PageBar
      leading={back}
      title={session.name}
      // Beside the name, as the frame draws it, rather than at the far end.
      meta={
        <StatusDot
          state={dot}
          density="compact"
          pulse={dot === 'pending'}
          className="shrink-0 text-xs text-fg-muted"
        >
          {t(`sessions.session.state.${stateWordFor(session)}`)}
        </StatusDot>
      }
      tabs={tabs}
      actions={
        <>
          {preview}
          <SessionShareButton sessionId={session.id} />
        </>
      }
      // On the terminal's ground with a hairline under it, whichever view is
      // on screen: the chat stands on the same ground, so bar, grid and chat
      // read as one surface and switching views changes no colour.
      className="border-b border-border-subtle bg-term-bg"
    />
  );
}
