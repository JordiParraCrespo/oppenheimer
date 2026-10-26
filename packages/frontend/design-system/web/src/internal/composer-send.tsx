'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { IconButton } from '../components/icon-button';

/**
 * What every composer shares, whatever it looks like (`Composer`, the
 * prompt box; `ChatComposer`, a bot's): when it may send, what Enter does,
 * and the send button that turns into Stop while the run is busy.
 *
 * - `useComposerSend`: send is off while nothing is written (unless
 *   `allowEmpty` and no file rides along), while the box is disabled, and
 *   while `sendBlockedReason` says why; Enter submits and Shift+Enter makes
 *   a new line, never mid-composition (an IME). While busy, submitting
 *   stops instead.
 * - `ComposerSendButton`: the round primary button in the foot's corner.
 *   Blocked, it stays focusable (`aria-disabled`, not `disabled`) with the
 *   reason as its description and title, so a keyboard or screen reader
 *   user hears why. Each composer draws its own size and glyphs.
 */
function useComposerSend({
  value,
  busy,
  disabled,
  sendBlockedReason,
  allowEmpty = false,
  attachmentCount = 0,
  onSubmit,
  onStop,
}: {
  value: string;
  busy: boolean;
  disabled: boolean;
  sendBlockedReason: string | undefined;
  allowEmpty?: boolean;
  attachmentCount?: number;
  onSubmit: (value: string) => void;
  onStop?: () => void;
}) {
  const blocked = !busy && sendBlockedReason !== undefined;
  const emptyAllowed = allowEmpty && attachmentCount === 0;
  const canSend = (emptyAllowed || value.trim().length > 0) && !disabled && !blocked;

  function submit() {
    if (busy) return onStop?.();
    if (canSend) onSubmit(value);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return { blocked, canSend, submit, onKeyDown };
}

function ComposerSendButton({
  busy,
  blocked,
  canSend,
  sendBlockedReason,
  labels,
  onClick,
  className,
  children,
}: {
  busy: boolean;
  blocked: boolean;
  canSend: boolean;
  sendBlockedReason: string | undefined;
  labels: { send: string; stop: string };
  onClick: () => void;
  className?: string;
  /** The glyph: the send arrow, or the stop square while busy. */
  children: React.ReactNode;
}) {
  const reasonId = React.useId();
  return (
    <>
      <IconButton
        aria-label={busy ? labels.stop : labels.send}
        aria-disabled={blocked || undefined}
        aria-describedby={blocked ? reasonId : undefined}
        title={blocked ? sendBlockedReason : undefined}
        variant="primary"
        size="sm"
        onClick={onClick}
        disabled={!busy && !blocked && !canSend}
        className={cn(
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-primary',
          className,
        )}
      >
        {children}
      </IconButton>
      {blocked ? (
        <span id={reasonId} className="sr-only">
          {sendBlockedReason}
        </span>
      ) : null}
    </>
  );
}

/**
 * The field with what is fused onto its top edge: `above` (a notice, an
 * approval), then `band` (New session's scope chips). With neither, the
 * field alone.
 */
function ComposerFrame({
  above,
  band,
  children,
}: {
  above?: React.ReactNode;
  band?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!above && !band) return children;
  return (
    <div data-slot="composer-stack" className="flex flex-col">
      {above}
      {band}
      {children}
    </div>
  );
}

/**
 * The foot row both composers share: what acts on the message (`leading`:
 * attach, the tools) on the left; the `engine` (model, effort); then the mic
 * and send (`children`) in the corner. On a box 448px wide or more it is one
 * line. On a narrower box (a phone) send keeps its corner on the first line
 * beside the tools, and the engine takes the line under them, so nothing is
 * stranded alone and the box never outgrows the screen. The box's own width
 * decides, not the screen's. Each composer sets its own gap and padding.
 */
function ComposerFoot({
  leading,
  engine,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { leading?: React.ReactNode; engine?: React.ReactNode }) {
  return (
    <div className="@container/composer-foot">
      <div className={cn('flex flex-wrap items-center', className)} {...props}>
        {leading}
        {engine ? (
          <span className="order-last flex basis-full flex-wrap items-center gap-[inherit] @md/composer-foot:order-none @md/composer-foot:ml-auto @md/composer-foot:basis-auto">
            {engine}
          </span>
        ) : null}
        {/* Send closes the row on the right: after the engine when there is
            one (which takes the auto margin from the medium width up), on
            its own when there is not. */}
        <span
          className={cn(
            'ml-auto flex items-center gap-[inherit]',
            engine ? '@md/composer-foot:ml-0' : undefined,
          )}
        >
          {children}
        </span>
      </div>
    </div>
  );
}

export { ComposerFoot, ComposerFrame, ComposerSendButton, useComposerSend };
