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
 *   stops instead. With `onAltSubmit`, Alt+Enter is a second way to send
 *   (a bot's "queue it for after"), under the same rules as send. With
 *   `onEmptyEnter`, Enter on a field with nothing to send is the caller's
 *   (a session's chat sends the message waiting first in its queue) rather
 *   than Stop. With `settle`, something is still landing in the draft (a
 *   recording being heard), and a send only lands it: nothing is sent, and
 *   the field (`fieldRef`) takes the focus with the caret at its end, so
 *   what was said is read first and the next Enter sends it.
 * - `ComposerRecorder`: the recorder in the field's place, while dictating.
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
  onAltSubmit,
  onEmptyEnter,
  settle,
}: {
  value: string;
  busy: boolean;
  disabled: boolean;
  sendBlockedReason: string | undefined;
  allowEmpty?: boolean;
  attachmentCount?: number;
  onSubmit: (value: string) => void;
  onStop?: () => void;
  onAltSubmit?: (value: string) => void;
  /** Enter with nothing to send: the caller's, in place of Stop. */
  onEmptyEnter?: () => void;
  /** Lands what is still on its way into the draft; while present, a send does only that. */
  settle?: () => Promise<unknown>;
}) {
  const blocked = !busy && sendBlockedReason !== undefined;
  const emptyAllowed = allowEmpty && attachmentCount === 0;
  const canSend = (emptyAllowed || value.trim().length > 0) && !disabled && !blocked;
  const fieldRef = React.useRef<HTMLTextAreaElement | null>(null);

  function submit() {
    // Before Stop: a busy agent is not stopped by a draft that is still landing.
    if (settle) {
      void settle().then(() => {
        const field = fieldRef.current;
        if (!field) return;
        field.focus();
        field.setSelectionRange(field.value.length, field.value.length);
      });
      return;
    }
    if (busy) return onStop?.();
    if (canSend) onSubmit(value);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (event.altKey && onAltSubmit) {
        if (canSend) onAltSubmit(value);
        return;
      }
      if (onEmptyEnter && !settle && !canSend && value.trim() === '') return onEmptyEnter();
      submit();
    }
  }

  return { blocked, canSend, submit, onKeyDown, fieldRef };
}

/** Hands a node to a caller's ref, beside the composer's own on the same field. */
function assignRef<T>(ref: React.Ref<T> | undefined, node: T | null) {
  if (typeof ref === 'function') ref(node);
  else if (ref) ref.current = node;
}

/**
 * The recorder bar where a composer's foot (or its whole line) was, while
 * dictating. The mic that started it unmounts as it appears, which drops
 * focus to the page; so it takes the focus then, and Enter on it is
 * `onEnter` (the composer's send, which ends the recording and sends
 * nothing). Enter on the bar's own buttons is theirs:
 * Stop stops and Cancel cancels.
 */
function ComposerRecorder({
  onEnter,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { onEnter: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  // Synchronises focus with the mic it replaced: only when nothing else holds it.
  React.useEffect(() => {
    if (!document.activeElement || document.activeElement === document.body) {
      ref.current?.focus();
    }
  }, []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={cn('outline-none', className)}
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' &&
          !event.shiftKey &&
          !event.nativeEvent.isComposing &&
          event.target === event.currentTarget
        ) {
          event.preventDefault();
          onEnter();
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
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
  // Always the same element around the field, `contents` while nothing sits
  // on it: a notice or a queued message appearing must not remount the
  // field, which would drop what has focus and the caret with it.
  return (
    <div data-slot="composer-stack" className={above || band ? 'flex flex-col' : 'contents'}>
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

export { assignRef, ComposerFoot, ComposerFrame, ComposerRecorder, ComposerSendButton, useComposerSend };
