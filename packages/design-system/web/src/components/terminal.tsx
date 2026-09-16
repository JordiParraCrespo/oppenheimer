import { ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Terminal — the product's primary surface. Oppenheimer orchestrates terminal
 * sessions, so the console is not a widget in a card: it is the whole right
 * side of the app. 13px SF Mono at 1.55, tabular figures, its own `--term-*`
 * ramp so output stays legible over long sessions on both themes. In light
 * mode the terminal is paper, not a dark rectangle in a light app.
 *
 * This is the frame. In the product the scrollback is xterm.js streaming a
 * PTY; `TerminalLine` renders the same vocabulary for the showcase, empty
 * states and replayed logs. `TerminalPrompt` is the pinned input row and
 * `TerminalStatusBar` the instrumentation band along the bottom.
 */
function Terminal({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="terminal"
      className={cn(
        'figures flex h-full min-h-0 flex-col bg-term-bg text-[13px] leading-[1.55] text-term-fg selection:bg-term-selection',
        className,
      )}
      {...props}
    />
  );
}

/** The scrollback: owns its scroll context so the prompt row never moves. */
function TerminalScrollback({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="terminal-scrollback"
      className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4 overscroll-contain', className)}
      {...props}
    />
  );
}

type TerminalTone = 'default' | 'dim' | 'accent' | 'success' | 'warning' | 'danger' | 'strong';

const TONE: Record<TerminalTone, string> = {
  default: '',
  dim: 'text-term-dim',
  accent: 'text-term-accent',
  success: 'text-term-success',
  warning: 'text-term-warning',
  danger: 'text-term-danger',
  strong: 'font-medium text-term-fg',
};

/**
 * One line of output. `command` prefixes the blue `$ `; `tone` colours the
 * line. Wraps, and breaks long tokens rather than scrolling sideways.
 */
function TerminalLine({
  tone = 'default',
  command,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { tone?: TerminalTone; command?: boolean }) {
  return (
    <div
      data-slot="terminal-line"
      data-tone={tone}
      className={cn('break-words whitespace-pre-wrap', TONE[tone], className)}
      {...props}
    >
      {command ? <span className="text-term-accent">$ </span> : null}
      {children}
    </div>
  );
}

/** A blank line's worth of air (0.775em, so paragraphs read as paragraphs). */
function TerminalSpacer() {
  return <div data-slot="terminal-spacer" className="h-[0.775em]" aria-hidden />;
}

/** The bullet that opens an agent's reply: a 6px dot, then the body. */
function TerminalTurn({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="terminal-turn" className={cn('my-2.5 flex gap-2.5', className)} {...props}>
      <span aria-hidden className="mt-[0.5em] size-1.5 shrink-0 rounded-pill bg-term-fg" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** The pinned input row: a blue chevron and a bare input on the terminal face. */
function TerminalPrompt({
  className,
  placeholder = 'Ask the agent, or run a command',
  ...props
}: React.ComponentProps<'input'>) {
  return (
    <div
      data-slot="terminal-prompt"
      className={cn('flex shrink-0 items-center gap-2 border-t border-term-border px-5 py-2.5', className)}
    >
      <ChevronRightIcon className="size-3.5 shrink-0 text-term-accent" strokeWidth={2.5} aria-hidden />
      <input
        type="text"
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent font-[inherit] text-inherit caret-term-caret outline-none placeholder:text-term-dim"
        {...props}
      />
    </div>
  );
}

/** The thin band along the bottom: usage, memory, permission mode, host count. */
function TerminalStatusBar({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="terminal-status"
      className={cn(
        'flex h-7 shrink-0 items-center gap-[18px] overflow-x-auto border-t border-term-border px-5 text-[11.5px] whitespace-nowrap text-term-dim [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function TerminalStatusItem({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="terminal-status-item"
      className={cn('flex shrink-0 items-center gap-1.5', className)}
      {...props}
    />
  );
}

export {
  Terminal,
  TerminalLine,
  TerminalPrompt,
  TerminalScrollback,
  TerminalSpacer,
  TerminalStatusBar,
  TerminalStatusItem,
  TerminalTurn,
};
export type { TerminalTone };
