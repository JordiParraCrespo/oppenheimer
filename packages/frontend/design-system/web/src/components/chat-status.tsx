'use client';

import { AlertCircleIcon, AlertTriangleIcon, XIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { IconButton } from './icon-button';

/**
 * Boundaries and status in the agent chat (Chat Components, Dividers and
 * status).
 *
 * - `TranscriptDivider`: where who answers, or where the thread came from,
 *   changes: a label centred between two hairlines ("Context handoff
 *   Sonnet → Codex", "Continued from chat"); `tone="danger"` for a handoff
 *   that failed. `action` is a control after the label (Open session); with
 *   one, the line is a row rather than a separator, so the control stays
 *   reachable.
 * - `ChatErrorBanner`: a turn that failed, on the card with a hairline: the
 *   red alert, the title, the error clamped to three lines with Show
 *   details, then actions that name what they do (Copy error, Continue
 *   task, Change model) and the dismiss.
 * - `ChatNotice`: one line about the run (a rate limit near or reached, a
 *   provider reconnecting), on the card at the 14px radius: a glyph or a
 *   dot in its tone, the line, at most one action or the dismiss.
 * - `FloatingChip`: a 28px pill that floats over the transcript while what
 *   it points to is scrolled away ("2 running ↑", Jump to latest); its
 *   `notice` form is a quiet wash with no shadow ("Watching CI on #668");
 *   its `round` form is a bot chat's way back to the latest turn, a 34px
 *   circle around one glyph (Bots), named by its `aria-label`.
 */
function TranscriptDivider({
  icon,
  tone = 'default',
  action,
  className,
  children,
}: {
  icon?: React.ReactNode;
  tone?: 'default' | 'danger';
  /** A small control after the label (a ghost `xs` Button). */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="transcript-divider"
      role={action ? undefined : 'separator'}
      className={cn(
        'flex items-center gap-4 py-2.5 text-[13px] before:h-px before:flex-1 before:bg-border-subtle after:h-px after:flex-1 after:bg-border-subtle',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex items-center gap-2 [&_svg]:size-3.5 [&_svg]:shrink-0',
          tone === 'danger' ? 'text-danger' : 'text-fg-muted',
        )}
      >
        {icon}
        {children}
      </span>
      {action ? <span className="-mx-2 flex shrink-0">{action}</span> : null}
    </div>
  );
}

type ChatErrorLabels = { details: string; less: string; dismiss: string };

function ChatErrorBanner({
  title,
  actions,
  onDismiss,
  labels,
  className,
  children,
}: {
  title: React.ReactNode;
  /** `ChatErrorAction`s: the recovery, named for what it does. */
  actions?: React.ReactNode;
  onDismiss?: () => void;
  labels?: Partial<ChatErrorLabels>;
  className?: string;
  /** The error as the provider said it. */
  children: React.ReactNode;
}) {
  const label = { details: 'Show details', less: 'Show less', dismiss: 'Dismiss error', ...labels };
  const [open, setOpen] = React.useState(false);
  return (
    <div
      data-slot="chat-error-banner"
      role="alert"
      className={cn('flex max-w-144 gap-2.5 rounded-lg border border-border-subtle bg-card py-3 pr-2.5 pl-3.5', className)}
    >
      <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-[14px] font-medium text-fg">{title}</span>
        <p
          className={cn(
            'm-0 text-[13px] leading-normal whitespace-pre-wrap wrap-anywhere text-fg-muted',
            !open && 'line-clamp-3',
          )}
        >
          {children}
        </p>
        <div className="-ml-1.5 flex flex-wrap gap-1">
          <ChatErrorAction variant="quiet" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? label.less : label.details}
          </ChatErrorAction>
          {actions}
        </div>
      </div>
      {onDismiss ? (
        <IconButton size="sm" aria-label={label.dismiss} onClick={onDismiss}>
          <XIcon />
        </IconButton>
      ) : null}
    </div>
  );
}

/**
 * A 26px action in a banner or notice. `quiet` is a bare text button (Show
 * details, Copy error); `outline` the hairline one (Change model, Check
 * setup); `danger` the recovery that resumes the failed work (Continue
 * task), outlined in red.
 */
function ChatErrorAction({
  variant = 'outline',
  className,
  ...props
}: Omit<React.ComponentProps<'button'>, 'type'> & { variant?: 'quiet' | 'outline' | 'danger' }) {
  return (
    <button
      type="button"
      data-slot="chat-error-action"
      className={cn(
        'inline-flex h-6.5 shrink-0 items-center gap-1 rounded-pill text-[12.5px] outline-none transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.25',
        variant === 'quiet' && 'px-2 text-fg-muted hover:bg-hover-surface',
        variant === 'outline' && 'border border-border px-2.5 text-fg hover:bg-hover-surface',
        variant === 'danger' && 'border border-danger px-2.5 text-danger hover:bg-danger-surface',
        className,
      )}
      {...props}
    />
  );
}

/**
 * `warning` and `danger` lead with their glyph (a limit near, a limit hit);
 * `pending` with a 7px amber dot, for something on its way back.
 */
function ChatNotice({
  tone,
  action,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
  children,
}: {
  tone: 'warning' | 'danger' | 'pending';
  action?: React.ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="chat-notice"
      data-tone={tone}
      role="status"
      className={cn('flex items-center gap-2.5 rounded-md bg-card py-2.5 pr-2.5 pl-3.5 text-[13px] text-fg', className)}
    >
      {tone === 'warning' ? <AlertTriangleIcon aria-hidden className="size-3.5 shrink-0 text-warning" /> : null}
      {tone === 'danger' ? <AlertCircleIcon aria-hidden className="size-3.5 shrink-0 text-danger" /> : null}
      {tone === 'pending' ? <span aria-hidden className="size-1.75 shrink-0 rounded-pill bg-warning" /> : null}
      <span className="min-w-0 flex-1">{children}</span>
      {action}
      {onDismiss ? (
        <IconButton size="sm" aria-label={dismissLabel} onClick={onDismiss}>
          <XIcon />
        </IconButton>
      ) : null}
    </div>
  );
}

function FloatingChip({
  variant = 'button',
  className,
  ...props
}: React.ComponentProps<'button'> & { variant?: 'button' | 'notice' | 'round' }) {
  if (variant === 'round') {
    return (
      <button
        type="button"
        data-slot="floating-chip"
        data-variant="round"
        className={cn(
          'inline-flex size-8.5 items-center justify-center rounded-pill border border-border-subtle bg-card text-fg shadow-popover outline-none transition-colors duration-fast hover:bg-control-hover focus-visible:ring-2 focus-visible:ring-ring motion-safe:animate-appear-fast [&_svg]:size-4',
          className,
        )}
        {...props}
      />
    );
  }
  if (variant === 'notice') {
    const { type: _, ...rest } = props;
    return (
      <span
        data-slot="floating-chip"
        data-variant="notice"
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-pill bg-hover-surface px-2.5 text-[12.5px] text-fg-muted [&_svg]:size-3.25',
          className,
        )}
        {...(rest as React.ComponentProps<'span'>)}
      />
    );
  }
  return (
    <button
      type="button"
      data-slot="floating-chip"
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-pill border border-border-subtle bg-card px-2.5 text-[12.5px] text-fg shadow-popover outline-none transition-colors duration-fast hover:bg-hover-surface focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.25',
        className,
      )}
      {...props}
    />
  );
}

export { ChatErrorAction, ChatErrorBanner, ChatNotice, FloatingChip, TranscriptDivider };
export type { ChatErrorLabels };
