import { Terminal, TerminalStatusBar, TerminalStatusItem } from '@oppenheimer/design-system-web';
import { useSessionStream } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { useSessionRefresh } from '../hooks/use-session-refresh';
import { useTerminal } from '../hooks/use-terminal';

/**
 * The session's terminal: the scrollback and the status band along the
 * bottom. No window strip — the design does not have one, and the design
 * system's tab CSS is kept "for when the console supports several at once",
 * which is a later slice.
 *
 * **There is no prompt row of ours.** The artboard draws one, but the
 * artboard's scrollback is hand-written DOM with no program behind it; a real
 * session has an agent drawing *its own* prompt inside the grid, so a second
 * field below it gave the pane two carets and no way to tell which one the
 * next keystroke reached. The agent's is the real one — it is what has the
 * history, the slash commands and the mode — so the grid keeps the input and
 * this renders none.
 *
 * The scrollback is xterm.js, mounted by `useTerminal` and fed by the attach
 * socket `app.sessions.openStream` opens with a ticket for this session
 * (`@oppenheimer/frontend-consumer`). Everything here holds a `SessionStream`,
 * not a socket.
 *
 * What the grid *contains* is drawn by the program on the far end. The
 * artboard's scrollback is hand-written DOM in the design's own vocabulary,
 * so plain output lands close to it and an agent drawing a full-screen TUI
 * does not. That is a property of terminals, not of this component.
 */
/** Window 0 is the agent's (05); the pane shows only that one today. */
const AGENT_WINDOW = 0;

export function SessionTerminal({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  const createStream = useSessionStream(sessionId, AGENT_WINDOW);
  const refresh = useSessionRefresh(sessionId);
  const { containerRef, status } = useTerminal(createStream, {
    onEnd: refresh,
    agentWindow: true,
  });

  return (
    <Terminal className="min-h-0 flex-1 overflow-hidden">
      {/* The padding is the wrapper's: the fit addon sizes the grid from its
          host element and counts that host's padding as usable space, so a
          padded host overflows its own box and paints over the rows below it.
          xterm owns everything inside the inner element, scrollbar included. */}
      <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
        <div ref={containerRef} className="size-full" />
      </div>

      <TerminalStatusBar>
        <TerminalStatusItem>
          <span
            data-status={status}
            className="size-1.5 rounded-pill bg-term-dim data-[status=live]:bg-term-success data-[status=offline]:bg-term-warning"
          />
          {t(`sessions.session.status.${status}`)}
        </TerminalStatusItem>
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
