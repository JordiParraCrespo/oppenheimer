import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon } from 'lucide-react';
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
 *
 * While the host is away the pane says so in one of two forms, both laid over
 * the frame (it is the positioning context): `TerminalBanner` takes the status
 * bar's place, with `TerminalDrawer` opening above it for the fix; or
 * `TerminalNotice` centres a card over the faded scrollback. Scrollback stays,
 * input is paused, and nothing asks to be pressed: the runner dials out, so
 * the session comes back on its own.
 */
function Terminal({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="terminal"
      className={cn(
        'figures relative flex h-full min-h-0 flex-col bg-term-bg text-[13px] leading-[1.55] text-term-fg selection:bg-term-selection',
        className,
      )}
      {...props}
    />
  );
}

/**
 * The scrollback: owns its scroll context so the prompt row never moves.
 * `fade` sinks it behind a `TerminalNotice`: `strong` while the host is
 * offline, `soft` while it catches up.
 */
function TerminalScrollback({
  fade,
  className,
  ...props
}: React.ComponentProps<'div'> & { fade?: 'soft' | 'strong' }) {
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
 * While the host is offline or catching up it is `disabled`, and the
 * placeholder says why ("Read-only while optimus is offline").
 */
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
 */
type TerminalLinkState = 'live' | 'reconnecting' | 'offline';

function TerminalLinkDot({ state }: { state: TerminalLinkState }) {
  return (
    <span
      aria-hidden
      data-slot="terminal-link-dot"
      data-link={state}
      className={cn(
        'size-1.5 shrink-0 rounded-pill transition-colors duration-slow ease-standard',
        state === 'live' && 'bg-success',
        state === 'reconnecting' && 'bg-warning motion-safe:animate-pulse-dot',
        state === 'offline' && 'bg-term-warning',
      )}
    />
  );
}

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
      <TerminalLinkDot state={state} />
      <span key={typeof children === 'string' ? children : state} className="motion-safe:animate-label-in">
        {children}
      </span>
    </TerminalStatusItem>
  );
}

/**
 * TerminalBanner — the status bar's place while the host is away, the same
 * 28px on a faint amber wash: the link dot, a title ("optimus is offline",
 * "Runner is back", "Reconnected"), a dim line that truncates first, the
 * mono time offline, and on the right the toggle for the fix
 * (`TerminalBannerToggle`). The title fades in when it changes. It speaks as
 * a status region, so a screen reader hears the change too.
 */
function TerminalBanner({
  state,
  title,
  description,
  elapsed,
  action,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  state: TerminalLinkState;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Mono time since the host went away ("2m 14s"). */
  elapsed?: React.ReactNode;
  /** The `TerminalBannerToggle`, while there is a fix to show. */
  action?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      data-slot="terminal-banner"
      data-link={state}
      className={cn(
        'flex h-7 shrink-0 items-center gap-2.5 overflow-hidden border-t border-term-border bg-[color-mix(in_srgb,var(--term-warning)_9%,var(--term-bg))] pr-1.5 pl-5 font-sans text-xs tracking-[-0.004em] text-term-fg',
        className,
      )}
      {...props}
    >
      <TerminalLinkDot state={state} />
      <span
        key={typeof title === 'string' ? title : state}
        className="shrink-0 font-medium motion-safe:animate-label-in"
      >
        {title}
      </span>
      {description ? (
        <span className="min-w-0 flex-1 truncate text-term-dim">{description}</span>
      ) : (
        <span className="flex-1" />
      )}
      {elapsed ? (
        <span className="figures shrink-0 font-mono text-[11.5px] text-term-dim">{elapsed}</span>
      ) : null}
      {action}
    </div>
  );
}

/**
 * The banner's one control: a 22px pill that opens the `TerminalDrawer` above
 * it ("How to fix"), its chevron pointing where the drawer will go.
 */
function TerminalBannerToggle({
  open = false,
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & { open?: boolean }) {
  const Chevron = open ? ChevronDownIcon : ChevronUpIcon;
  return (
    <button
      type="button"
      data-slot="terminal-banner-toggle"
      aria-expanded={open}
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center gap-[5px] rounded-pill pr-2 pl-2.5 font-medium text-term-fg outline-none transition-colors duration-instant ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    >
      {children}
      <Chevron className="size-[13px]" aria-hidden />
    </button>
  );
}

/**
 * TerminalDrawer — the fix, opened from the banner: a panel on the terminal
 * face that rises over the bottom of the scrollback and sits on the banner,
 * a hairline on top. Holds a sentence (`TerminalDrawerText`), the commands to
 * run on the host (`CommandRowList` with `surface="terminal"`) and a link to
 * Settings → Hosts.
 */
function TerminalDrawer({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="terminal-drawer"
      className={cn(
        'absolute inset-x-0 bottom-7 z-5 flex flex-col gap-3.5 border-t border-term-border bg-term-bg px-5 pt-4 pb-[18px] font-sans text-term-fg motion-safe:animate-appear-fast',
        className,
      )}
      {...props}
    />
  );
}

function TerminalDrawerText({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="terminal-drawer-text"
      className={cn('m-0 max-w-[62ch] text-[13.5px] leading-normal tracking-[-0.006em] text-pretty', className)}
      {...props}
    />
  );
}

/**
 * TerminalNotice — the card form of the same news: a 420px card centred over
 * the scrollback (pair it with `TerminalScrollback fade`), clear of the status
 * bar. A mono eyebrow with the link dot ("offline · 2m 14s"), the title, a
 * muted paragraph, and, while there is one, the fix under a hairline.
 * The card takes the pointer; the space around it does not. A pane too short
 * for it scrolls the card, never past the status bar.
 */
function TerminalNotice({
  state,
  eyebrow,
  title,
  description,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  state: TerminalLinkState;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** The fix: a `CommandRowList` and a link, drawn under a hairline. */
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="terminal-notice"
      className="pointer-events-none absolute inset-x-0 top-0 bottom-7 z-5 flex items-center justify-center p-4"
    >
      <div
        role="status"
        data-link={state}
        className={cn(
          'pointer-events-auto flex max-h-full w-full max-w-105 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-card px-6 pt-[22px] pb-5 font-sans text-fg motion-safe:animate-appear',
          className,
        )}
        {...props}
      >
        <div className="flex flex-col gap-1.5">
          {eyebrow ? (
            <span className="figures flex items-center gap-2 font-mono text-[11.5px] text-term-dim">
              <TerminalLinkDot state={state} />
              {eyebrow}
            </span>
          ) : null}
          <h2
            key={typeof title === 'string' ? title : state}
            className="m-0 text-[17px] leading-[1.3] font-semibold tracking-[-0.016em] motion-safe:animate-label-in"
          >
            {title}
          </h2>
          {description ? (
            <p className="m-0 text-[13.5px] leading-normal text-fg-muted text-pretty">{description}</p>
          ) : null}
        </div>
        {children ? (
          <div className="flex flex-col gap-2.5 border-t border-border-subtle pt-4">{children}</div>
        ) : null}
      </div>
    </div>
  );
}

export {
  Terminal,
  TerminalBanner,
  TerminalBannerToggle,
  TerminalDrawer,
  TerminalDrawerText,
  TerminalLine,
  TerminalNotice,
  TerminalPrompt,
  TerminalScrollback,
  TerminalSpacer,
  TerminalStatusBar,
  TerminalStatusItem,
  TerminalStatusLink,
  TerminalTurn,
};
export type { TerminalLinkState };
export type { TerminalTone };
