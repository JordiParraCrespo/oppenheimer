import { StatusDot } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { PageBar } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AgentReportNote } from '../components/agent-report-note';
import { agentNoteFor, dotFor, stateWordFor } from '../lib/session-run-state';
import { SessionShareButton } from './session-share-button';

/**
 * A session's bar: the sidebar toggle, the task it came from when there is
 * one, the session's name and its state on a dot, then the view switch and
 * Share on the right. It is the page's bar, not a band inside the terminal,
 * so the terminal under it runs to the pane's edges and its own status line
 * keeps only the link.
 *
 * When the agent itself said what it is doing (OSC 7501), its word follows
 * the state: why it waits, and its own message.
 *
 * Under Sessions the route hands it the open tabs (`open`): they take the
 * name's place, the state moves to the tab's dot and tooltip, and the bar
 * keeps one line.
 *
 * Every state of the session draws it — starting, live, stopped — so the way
 * back to the sidebar never moves. `preview` is the toggle for the pane the
 * frame opens beside a session; of its two tabs only the Simulator is built.
 */
export function SessionBar({
  session,
  back,
  open,
  tabs,
  preview,
}: {
  session: SessionEntity;
  /** "Back to task", when the route has one. */
  back?: ReactNode;
  /**
   * The open tabs over Sessions, from the route: the bar's title. The name
   * and state are then this session's tab and its tooltip.
   */
  open?: ReactNode;
  /** Terminal / Chat, once the chat is offered. */
  tabs?: ReactNode;
  /** The preview pane's toggle, while the session is live. */
  preview?: ReactNode;
}) {
  const { t } = useTranslation();
  const dot = dotFor(session);
  const note = agentNoteFor(session);
  return (
    <PageBar
      leading={back}
      title={open ?? session.name}
      // Beside the name, as the frame draws it, rather than at the far end.
      meta={
        open ? null : (
          <>
            <StatusDot
              state={dot}
              density="compact"
              pulse={dot === 'pending'}
              className="shrink-0 text-xs text-fg-muted"
            >
              {t(`sessions.session.state.${stateWordFor(session)}`)}
            </StatusDot>
            {note ? <AgentReportNote word={note.word} message={note.message} /> : null}
          </>
        )
      }
      tabs={tabs}
      // A cloud session has no terminal here: no device beside it, nothing to share.
      actions={
        session.isCloud ? null : (
          <>
            {open && tabs ? (
              <span aria-hidden className="mx-1.5 h-4.5 w-px bg-border-subtle" />
            ) : null}
            {preview}
            <SessionShareButton sessionId={session.id} />
          </>
        )
      }
      // On the terminal's ground with a hairline under it, whichever view is
      // on screen, so switching views changes no colour: the tab bar's own
      // with tabs, a guest's (no tabs) named here.
      tone={open ? 'chrome' : 'page'}
      className={open ? undefined : 'border-b border-border-subtle bg-term-bg'}
    />
  );
}
