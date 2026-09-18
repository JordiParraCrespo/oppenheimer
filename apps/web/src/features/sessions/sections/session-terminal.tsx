import { Terminal, TerminalStatusBar, TerminalStatusItem } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { useTerminal } from '../hooks/use-terminal';
import { createFakeSessionStream } from '../lib/session-stream';

/** tmux windows. Window 0 is the agent; the rest are shells in the worktree. */
const WINDOWS = [
  { id: 0, label: 'claude' },
  { id: 1, label: 'zsh' },
  { id: 2, label: 'pnpm dev' },
];

/**
 * The session's terminal pane: the tmux window strip, the grid itself, and the
 * status line of `product/versions/mvp/05-screens.md`.
 *
 * The grid is xterm.js, mounted by `useTerminal`, fed for now by the replay
 * in `session-stream.ts`. Swapping in the runner's WebSocket is this one
 * import: everything above holds a `SessionStream`, not a socket.
 * Keystrokes go straight into the stream — you type into the terminal, the way
 * a terminal works, and the host echoes back. The pinned composer the design
 * export draws is a second, additive input; it cannot replace this one,
 * because a line-at-a-time box cannot send Ctrl-C, arrow keys or a tab
 * completion, and the agent's own login flow needs all three.
 */
export function SessionTerminal() {
  const { t } = useTranslation();
  const { containerRef, status, grid } = useTerminal(createFakeSessionStream);

  return (
    <div className="h-160 overflow-hidden rounded-lg border border-term-border">
      <Terminal className="h-full">
        <div className="flex shrink-0 items-stretch overflow-x-auto border-term-border border-b">
          {WINDOWS.map((window) => (
            <div
              key={window.id}
              data-active={window.id === 0}
              className="flex shrink-0 items-center gap-2 border-term-border border-r px-3.5 py-2 text-xs text-term-dim data-[active=true]:bg-term-selection data-[active=true]:text-term-fg"
            >
              <span className="text-term-dim">{window.id}:</span>
              {window.label}
            </div>
          ))}
        </div>

        {/* The padding is the wrapper's: the fit addon sizes the grid from its
            host element and counts that host's padding as usable space, so a
            padded host overflows its own box and paints over the status bar.
            xterm owns everything inside the inner element, scrollbar included. */}
        <div className="min-h-0 flex-1 overflow-hidden px-4 py-3">
          <div ref={containerRef} className="size-full" />
        </div>

        <TerminalStatusBar>
          <TerminalStatusItem>
            <span
              data-status={status}
              className="size-1.5 rounded-pill bg-term-dim data-[status=live]:bg-term-success"
            />
            {t(`sessions.session.status.${status}`)}
          </TerminalStatusItem>
          <TerminalStatusItem>jordis-mac-studio</TerminalStatusItem>
          <TerminalStatusItem>feat/terminal-surface</TerminalStatusItem>
          <TerminalStatusItem>claude-code</TerminalStatusItem>
          {grid.cols > 0 ? (
            <TerminalStatusItem>
              {grid.cols}×{grid.rows}
            </TerminalStatusItem>
          ) : null}
        </TerminalStatusBar>
      </Terminal>
    </div>
  );
}
