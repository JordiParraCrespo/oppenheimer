import { Terminal, TerminalStatusBar, TerminalStatusItem } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { SessionComposer } from '../components/session-composer';
import { useTerminal } from '../hooks/use-terminal';
import { createFakeSessionStream } from '../lib/session-stream';

/**
 * The session's terminal: scrollback, the pinned prompt row, and the status
 * band along the bottom — the three parts of the session artboard in
 * `product/versions/mvp/design/version1/SessionsConsole.dc.html`, in that
 * order and nothing else. No window strip: the design does not have one, and
 * the design system's tab CSS is kept "for when the console supports several
 * at once", which is a later slice.
 *
 * The scrollback is xterm.js, mounted by `useTerminal`, fed for now by the
 * replay in `session-stream.ts`. Swapping in the runner's WebSocket is that
 * one import: everything above holds a `SessionStream`, not a socket.
 *
 * What the grid *contains* is drawn by the program on the far end. The
 * artboard's scrollback is hand-written DOM in the design's own vocabulary,
 * so plain output lands close to it and an agent drawing a full-screen TUI
 * does not. That is a property of terminals, not of this component.
 */
export function SessionTerminal() {
  const { t } = useTranslation();
  const { containerRef, status, grid, submit } = useTerminal(createFakeSessionStream);

  return (
    <Terminal className="min-h-0 flex-1 overflow-hidden">
      {/* The padding is the wrapper's: the fit addon sizes the grid from its
          host element and counts that host's padding as usable space, so a
          padded host overflows its own box and paints over the rows below it.
          xterm owns everything inside the inner element, scrollbar included. */}
      <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
        <div ref={containerRef} className="size-full" />
      </div>

      <SessionComposer onSubmit={submit} />

      <TerminalStatusBar>
        <TerminalStatusItem>
          <span
            data-status={status}
            className="size-1.5 rounded-pill bg-term-dim data-[status=live]:bg-term-success"
          />
          {t(`sessions.session.status.${status}`)}
        </TerminalStatusItem>
        {/* The artboard's other items — context used, rate-limit windows,
            memory, permission mode, host count — are numbers the runner and
            the control plane report. They stay out until there is something
            real to put in them. */}
        {grid.cols > 0 ? (
          <TerminalStatusItem>
            {grid.cols}×{grid.rows}
          </TerminalStatusItem>
        ) : null}
      </TerminalStatusBar>
    </Terminal>
  );
}
