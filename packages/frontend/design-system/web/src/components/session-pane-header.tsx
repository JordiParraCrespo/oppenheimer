import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { StatusDot, type StatusState } from './status-dot';

/**
 * SessionPaneHeader — the bar over a session's terminal, on the pane's card
 * surface with a hairline under it: the session in mono, its run state on
 * `StatusDot`, and on the right what drives it (agent · model · repository)
 * in small mono. It sits above the terminal and in the console's palette;
 * the terminal's own `TerminalStatusBar` is the band along its bottom. When the session was opened from a task, `back`
 * leads the bar with a `SessionPaneBack` link to that task and a slash, so
 * the reader can return to Plan the way they came.
 */
function SessionPaneHeader({
  state,
  name,
  stateLabel,
  meta,
  back,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  state: StatusState;
  name: React.ReactNode;
  /** "Running", "Needs input" — the caller's word for `state`. */
  stateLabel: React.ReactNode;
  /** "claude-code · sonnet 4.6 · xrp-mobile". */
  meta?: React.ReactNode;
  /** A `SessionPaneBack`, when the session was opened from a task. */
  back?: React.ReactNode;
}) {
  return (
    <div
      data-slot="session-pane-header"
      data-state={state}
      className={cn(
        'flex h-11.5 min-w-0 shrink-0 items-center gap-2.5 border-b border-border-subtle bg-card pr-3 pl-3.5',
        className,
      )}
      {...props}
    >
      {back ? (
        <>
          {back}
          <span aria-hidden className="shrink-0 text-fg-subtle">
            /
          </span>
        </>
      ) : null}
      <span className="min-w-0 truncate font-mono text-sm text-fg">{name}</span>
      <StatusDot state={state} density="compact" className="shrink-0 text-xs text-fg-muted">
        {stateLabel}
      </StatusDot>
      <span className="flex-1" />
      {meta ? <span className="min-w-0 truncate font-mono text-micro text-fg-subtle">{meta}</span> : null}
    </div>
  );
}

/**
 * The way back to the task a session was opened from: its title, truncated
 * at 240px, as a quiet link before the slash. No glyph: a status glyph
 * belongs to a finished run, and the slash already reads as the way back. The app passes its
 * router's link through `render`.
 */
function SessionPaneBack({ render, className, children, ...props }: useRender.ComponentProps<'a'>) {
  return useRender({
    defaultTagName: 'a',
    render,
    props: mergeProps<'a'>(
      {
        className: cn(
          'inline-flex h-(--control-h-sm) max-w-60 shrink-0 items-center rounded-pill px-2.5 text-sm text-fg-muted no-underline outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-ring',
          className,
        ),
        children: <span className="truncate">{children}</span>,
      },
      props,
    ),
    state: { slot: 'session-pane-back' },
  });
}

export { SessionPaneBack, SessionPaneHeader };
