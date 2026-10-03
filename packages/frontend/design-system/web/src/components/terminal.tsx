'use client';

import { ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';

import {
  HostLinkContext,
  LinkDot,
  resolveHostLink,
  type TerminalHostLink,
  type TerminalLinkState,
  useHostLink,
} from '../internal/host-link';
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
 *
 * `hostLink` is where the session's link to its host stands (a phase of
 * `HostLinkPhase`, the form, the host's name). The frame acts on it itself:
 * the scrollback fades behind the notice card and the prompt locks with a
 * placeholder that says why. `HostLinkChrome`, in the status bar's place,
 * draws the rest. Without it the link is live.
 */
function Terminal({
  hostLink,
  className,
  ...props
}: React.ComponentProps<'div'> & { hostLink?: TerminalHostLink }) {
  const link = resolveHostLink(hostLink);
  return (
    <HostLinkContext value={link}>
      <div
        data-slot="terminal"
        data-host-link={link.phase}
        className={cn(
          'figures relative flex h-full min-h-0 flex-col bg-term-bg text-[13px] leading-[1.55] text-term-fg selection:bg-term-selection',
          className,
        )}
        {...props}
      />
    </HostLinkContext>
  );
}

/**
 * The scrollback: owns its scroll context so the prompt row never moves.
 * Behind the host link's notice card it fades back, further while the host
 * is offline than while it catches up.
 */
function TerminalScrollback({ className, ...props }: React.ComponentProps<'div'>) {
  const { form, row } = useHostLink();
  const fade = form === 'notice' ? row.card || undefined : undefined;
  return (
    <div
      data-slot="terminal-scrollback"
      data-fade={fade}
      className={cn(
        'min-h-0 flex-1 overflow-y-auto px-5 py-4 overscroll-contain transition-opacity duration-base ease-standard data-[fade=soft]:opacity-60 data-[fade=strong]:opacity-[0.28]',
        className,
      )}
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

/**
 * The pinned input row: a blue chevron and a bare input on the terminal face.
 * While the host link locks it (offline, catching up) it is disabled, and in
 * any phase that changes what input does the placeholder says so ("Read-only
 * while optimus is offline").
 */
function TerminalPrompt({
  className,
  placeholder = 'Ask the agent, or run a command',
  disabled,
  ...props
}: React.ComponentProps<'input'>) {
  const { phase, host, labels, row } = useHostLink();
  const phasePlaceholder = labels.placeholder[phase];
  return (
    <div
      data-slot="terminal-prompt"
      className={cn('flex shrink-0 items-center gap-2 border-t border-term-border px-5 py-2.5', className)}
    >
      <ChevronRightIcon className="size-3.5 shrink-0 text-term-accent" strokeWidth={2.5} aria-hidden />
      <input
        type="text"
        placeholder={phasePlaceholder ? phasePlaceholder(host) : placeholder}
        disabled={disabled || row.locked}
        className="min-w-0 flex-1 border-0 bg-transparent font-[inherit] text-inherit caret-term-caret outline-none placeholder:text-term-dim disabled:cursor-not-allowed"
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

/**
 * The link to the host, as the status bar's first item: green while the
 * session is live, amber and pulsing while the console reconnects, amber and
 * still once the host is offline. The label beside it fades in each time it
 * changes, so the switch reads as an event rather than a flicker.
 * `HostLinkChrome` draws it from the phase; it is here for a status bar that
 * draws its own.
 */
function TerminalStatusLink({
  state,
  className,
  children,
  ...props
}: React.ComponentProps<'span'> & { state: TerminalLinkState }) {
  return (
    <TerminalStatusItem
      data-link={state}
      className={cn(state !== 'live' && 'text-term-fg', className)}
      {...props}
    >
      <LinkDot state={state} />
      <span key={typeof children === 'string' ? children : state} className="motion-safe:animate-label-in">
        {children}
      </span>
    </TerminalStatusItem>
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
  TerminalStatusLink,
  TerminalTurn,
};
export type { TerminalHostLink, TerminalLinkState };
export type { TerminalTone };
