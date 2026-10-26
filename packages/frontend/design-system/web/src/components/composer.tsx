'use client';

import { ArrowUpIcon, ChevronDownIcon, PaperclipIcon, PlusIcon, SquareIcon, XIcon } from 'lucide-react';
import type * as React from 'react';

import { ComposerFoot, ComposerFrame, ComposerSendButton, useComposerSend } from '../internal/composer-send';
import { cn } from '../lib/utils';
import type { DictationSlot } from './chat-composer-extras';
import { IconButton } from './icon-button';

type ComposerAttachment = { id: string; name: string };

/**
 * What the composer's icon buttons say to a screen reader. English by default
 * for the showcase; a product passes its own, translated, since a label nobody
 * can override ships in one language to everyone.
 */
type ComposerLabels = {
  send: string;
  stop: string;
  attach: string;
  /** The remove button on one attachment chip. */
  removeAttachment: (name: string) => string;
};

const DEFAULT_COMPOSER_LABELS: ComposerLabels = {
  send: 'Send',
  stop: 'Stop',
  attach: 'Attach a file',
  removeAttachment: (name) => `Remove ${name}`,
};

/**
 * What `Composer` and `ComposerPill` draw alike, kept in one place so a rule
 * changed for one is changed for both: the files held for the message, the
 * send button's glyph (the arrow, or stop while busy), and the dictation
 * notice under the box. The send rules themselves are
 * `internal/composer-send`'s. Each composer keeps its own frame, because
 * the frame is what differs.
 */
function ComposerFileList({
  attachments,
  removeLabel,
  onRemove,
  className,
}: {
  attachments?: ComposerAttachment[];
  removeLabel: (name: string) => string;
  onRemove?: (id: string) => void;
  className?: string;
}) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div data-slot="composer-attachments" className={cn('flex flex-wrap gap-1.5', className)}>
      {attachments.map((file) => (
        <ComposerFile
          key={file.id}
          name={file.name}
          removeLabel={removeLabel(file.name)}
          onRemove={() => onRemove?.(file.id)}
        />
      ))}
    </div>
  );
}

function ComposerSendGlyph({ busy }: { busy: boolean }) {
  return busy ? (
    <SquareIcon className="size-3.5 fill-current" />
  ) : (
    <ArrowUpIcon className="size-[15px]" strokeWidth={2.2} />
  );
}

function ComposerNoticeFrame({ notice, children }: { notice?: React.ReactNode; children: React.ReactNode }) {
  if (!notice) return children;
  return (
    <div data-slot="composer-dictation" className="flex flex-col gap-2">
      {children}
      <div className="mx-4.5">{notice}</div>
    </div>
  );
}

/**
 * Composer — the prompt box: an 18px-radius field holding a growing textarea,
 * then a foot row with the tools. Focus takes the blue border and ring. Enter
 * submits, Shift+Enter inserts a newline; while `busy` the send button becomes
 * a stop button in the same corner.
 *
 * The foot row reads scope of action, then engine: attach and `tools` (the
 * permission level) on the left; a spacer; `engine` (agent, model, effort) on
 * the right; then mic and the round primary send. Both slots take
 * `ComposerToolButton`s. `dictation` (`DictationSlot`) puts the mic before
 * send; while dictating its recorder takes the foot row's place, and its
 * notice sits under the box. Attachments list under the textarea as removable
 * chips; they are never silently dropped.
 *
 * `sendBlockedReason` keeps the box usable but the send off, and says why
 * ("fable is offline — pick another host"): the draft is fine, the scope
 * above it is not. The button stays focusable (`aria-disabled`, not
 * `disabled`) with the reason as its description, so a keyboard or screen
 * reader user hears it, and as its title for the pointer.
 *
 * `scope` is New session's tabbed form: the scope chips (`ChipSelectTrigger`,
 * `tab` variant) sit in a grey band fused to the top of the field (control
 * fill, 18px top radii, inset 18px each side). With a band the field is the
 * taller one, 128px at 15px, because the sentence above has already said where
 * the work happens.
 *
 * `above` fuses something the run is waiting on to the field's top edge (a
 * `ComposerApproval`): it brings its own top radius and hairline, and the
 * field squares its top to meet it, so the two read as one box.
 *
 * A bot's composer is `ChatComposer`, which shares the send rules and the
 * send button with this one.
 */
function Composer({
  value,
  onValueChange,
  onSubmit,
  onStop,
  busy = false,
  disabled = false,
  sendBlockedReason,
  allowEmpty = false,
  placeholder = 'Describe a task or ask a question',
  attachments,
  onRemoveAttachment,
  onAttach,
  dictation,
  tools,
  engine,
  scope,
  above,
  minRows = 3,
  labels,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onSubmit'> & {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop?: () => void;
  busy?: boolean;
  disabled?: boolean;
  /** Why the draft cannot be sent yet, though it can be written. Present: send is off and says this. */
  sendBlockedReason?: string;
  /**
   * Send with nothing written: what is sent needs no text (a blank terminal).
   * Holds only while no file is attached: a file rides a written task, so the
   * text is required again as soon as one is.
   */
  allowEmpty?: boolean;
  placeholder?: string;
  attachments?: ComposerAttachment[];
  onRemoveAttachment?: (id: string) => void;
  /** Present: shows the attach button. */
  onAttach?: () => void;
  /** Dictation: the mic before send, the recorder in the foot row's place, the notice under the box. */
  dictation?: DictationSlot;
  /** Controls after attach: what the run may touch (the permission level). */
  tools?: React.ReactNode;
  /** Controls before the mic: who drives it and how hard it thinks (agent, model, effort). */
  engine?: React.ReactNode;
  /** The scope chips, in the band fused to the top of the field (`ChipSelectTrigger variant="tab"`). */
  scope?: React.ReactNode;
  /** What the run waits on, fused to the field's top edge (`ComposerApproval`). */
  above?: React.ReactNode;
  minRows?: number;
  /** The icon buttons' accessible names; any left out stay in English. */
  labels?: Partial<ComposerLabels>;
}) {
  const label = { ...DEFAULT_COMPOSER_LABELS, ...labels };
  const { blocked, canSend, submit, onKeyDown } = useComposerSend({
    value,
    busy,
    disabled,
    sendBlockedReason,
    allowEmpty,
    attachmentCount: attachments?.length,
    onSubmit,
    onStop,
  });

  const box = (
    <ComposerFrame
      above={above}
      band={
        scope ? (
          <div
            data-slot="composer-scope"
            className="mx-[18px] flex flex-wrap items-center gap-0.5 self-stretch rounded-t-lg bg-control px-2 py-1"
          >
            {scope}
          </div>
        ) : undefined
      }
    >
      <div
        data-slot="composer"
        data-disabled={disabled || undefined}
        data-tabbed={scope ? '' : undefined}
        data-above={above ? '' : undefined}
        className={cn(
          'flex flex-col rounded-lg border border-field-border bg-field transition-[border-color,box-shadow] duration-fast ease-standard has-focus-visible:border-primary has-focus-visible:ring-3 has-focus-visible:ring-ring data-above:rounded-t-none data-above:border-t-border-subtle data-disabled:opacity-50',
          className,
        )}
        {...props}
      >
        <textarea
          data-slot="composer-input"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={minRows}
          // `min-h`, not `rows`: `field-sizing-content` overrides `rows`, so an
          // empty composer would collapse to one line. The floor is the export's
          // 112px (`.op-composer__input`); `rows` stays for the no-`field-sizing`
          // fallback.
          className={cn(
            'field-sizing-content max-h-[40svh] w-full resize-none bg-transparent px-[18px] py-4 text-fg outline-none placeholder:text-field-placeholder',
            scope ? 'min-h-32 text-[15px] leading-normal' : 'min-h-28 text-compose',
          )}
        />
        <ComposerFileList
          attachments={attachments}
          removeLabel={label.removeAttachment}
          onRemove={onRemoveAttachment}
          className="px-3 pb-2.5"
        />
        {dictation?.recorder ? (
          // The bar is 16px taller than the foot row it replaces; it takes
          // that from the field's bottom padding, so the box keeps its height.
          <div data-slot="composer-recorder" className="-mt-4 px-2.5 pb-2.5">
            {dictation.recorder}
          </div>
        ) : (
        <ComposerFoot
          data-slot="composer-foot"
          className="gap-1.5 px-2.5 pb-2.5"
          leading={
            <>
              {onAttach ? (
                <IconButton
                  aria-label={label.attach}
                  size="sm"
                  shape="square"
                  onClick={onAttach}
                  className="size-[30px]"
                >
                  <PaperclipIcon className="size-[15px]" />
                </IconButton>
              ) : null}
              {tools}
            </>
          }
          engine={engine}
        >
          {dictation?.mic}
          <ComposerSendButton
            busy={busy}
            blocked={blocked}
            canSend={canSend}
            sendBlockedReason={sendBlockedReason}
            labels={label}
            onClick={submit}
            className="size-8"
          >
            <ComposerSendGlyph busy={busy} />
          </ComposerSendButton>
        </ComposerFoot>
        )}
      </div>
    </ComposerFrame>
  );
  return <ComposerNoticeFrame notice={dictation?.notice}>{box}</ComposerNoticeFrame>;
}

/**
 * ComposerPill — New session's prompt (`NewSessionComposer.dc.html`, the
 * 2026-10-25 export): one 28px-radius box holding a line that grows, with
 * Add files (+) at its start and the mic and the round send at its end, so
 * the box reads as a sentence to finish rather than a form to fill. What the
 * run will use is not inside it: the caller lays those choices on a
 * `ComposerChoices` row under the box.
 *
 * It shares `Composer`'s send rules and its send button
 * (`internal/composer-send`): Enter sends, Shift+Enter breaks a line, a
 * `sendBlockedReason` keeps send focusable and says why it is off, and while
 * `busy` send becomes stop. Files list above the line as removable chips;
 * a recording takes a row under it, standing in for the mic and send until
 * it ends, and its notice sits under the box.
 */
function ComposerPill({
  value,
  onValueChange,
  onSubmit,
  onStop,
  busy = false,
  disabled = false,
  sendBlockedReason,
  allowEmpty = false,
  placeholder = 'Describe a task or ask a question',
  attachments,
  onRemoveAttachment,
  onAttach,
  dictation,
  labels,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onSubmit'> & {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop?: () => void;
  busy?: boolean;
  disabled?: boolean;
  /** Why the draft cannot be sent yet, though it can be written. Present: send is off and says this. */
  sendBlockedReason?: string;
  /** Send with nothing written, while no file rides along (a blank terminal). */
  allowEmpty?: boolean;
  placeholder?: string;
  attachments?: ComposerAttachment[];
  onRemoveAttachment?: (id: string) => void;
  /** Present: shows Add files at the line's start. */
  onAttach?: () => void;
  /** Dictation: the mic before send, the recorder under the line, the notice under the box. */
  dictation?: DictationSlot;
  /** The icon buttons' accessible names; any left out stay in English. */
  labels?: Partial<ComposerLabels>;
}) {
  const label = { ...DEFAULT_COMPOSER_LABELS, ...labels };
  const { blocked, canSend, submit, onKeyDown } = useComposerSend({
    value,
    busy,
    disabled,
    sendBlockedReason,
    allowEmpty,
    attachmentCount: attachments?.length,
    onSubmit,
    onStop,
  });

  const box = (
    <div
      data-slot="composer-pill"
      data-disabled={disabled || undefined}
      className={cn(
        'flex flex-col gap-1.5 rounded-xl border border-field-border bg-field p-1.5 transition-[border-color,box-shadow] duration-fast ease-standard has-focus-visible:border-primary has-focus-visible:ring-3 has-focus-visible:ring-ring data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <ComposerFileList
        attachments={attachments}
        removeLabel={label.removeAttachment}
        onRemove={onRemoveAttachment}
        className="px-3 pt-2"
      />
      <div className="flex items-end gap-1">
        {onAttach ? (
          <IconButton
            aria-label={label.attach}
            title={label.attach}
            size="sm"
            onClick={onAttach}
            className="mb-1.5 ml-1 size-8 shrink-0 text-fg-muted"
          >
            <PlusIcon className="size-4.25" />
          </IconButton>
        ) : null}
        <textarea
          data-slot="composer-input"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          // Enter waits for the recording too, for the reason send does below.
          onKeyDown={dictation?.recorder ? undefined : onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="field-sizing-content max-h-52 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-2.5 text-[15px] leading-normal tracking-[-0.011em] text-fg outline-none placeholder:text-field-placeholder"
        />
        {/* While a recording is open its bar holds the controls, as it takes
            `Composer`'s foot row: a send pressed mid-sentence would start the
            session on the typed half and drop what is still being heard. */}
        {dictation?.recorder ? null : (
          <span className="flex shrink-0 items-center gap-1 p-1.5">
            {dictation?.mic}
            <ComposerSendButton
              busy={busy}
              blocked={blocked}
              canSend={canSend}
              sendBlockedReason={sendBlockedReason}
              labels={label}
              onClick={submit}
              className="ml-1 size-8"
            >
              <ComposerSendGlyph busy={busy} />
            </ComposerSendButton>
          </span>
        )}
      </div>
      {dictation?.recorder ? (
        <div data-slot="composer-recorder" className="px-1 pb-1">
          {dictation.recorder}
        </div>
      ) : null}
    </div>
  );
  return <ComposerNoticeFrame notice={dictation?.notice}>{box}</ComposerNoticeFrame>;
}

/**
 * ComposerChoices — the row under a `ComposerPill`: what the run will use, as
 * quiet 30px choices that read left to right as where it runs and what it may
 * touch (`children`: the place, the repositories and branch, the permission
 * level), then, pushed to the right, who drives it (`engine`: the agent and
 * model, the effort). It is always one line: when it runs out of room the
 * choices on the left give way, each truncating its label, and the engine
 * keeps its full width at the right edge.
 */
function ComposerChoices({
  engine,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { engine?: React.ReactNode }) {
  return (
    <div
      data-slot="composer-choices"
      className={cn('flex min-h-8.5 items-center gap-0.5 px-0.5', className)}
      {...props}
    >
      <span className="flex min-w-0 flex-1 items-center gap-0.5 [&_button]:min-w-0 [&_button]:shrink sm:[&_button]:min-w-18">
        {children}
      </span>
      {engine ? <span className="flex shrink-0 items-center gap-0.5">{engine}</span> : null}
    </div>
  );
}

/**
 * ComposerToolButton — the 30px text trigger in the composer's foot row: an
 * optional 14px leading mark, the label, a 12px chevron when it opens a menu.
 * Transparent at rest, the hover wash on hover and while its menu is open.
 * `tone="muted"` for a setting (permission level, effort) so the model, which
 * is the engine, reads darkest; `tone="warning"` for the one setting that
 * can change a machine unattended.
 */
function ComposerToolButton({
  icon,
  tone = 'default',
  chevron = true,
  open,
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & {
  icon?: React.ReactNode;
  tone?: 'default' | 'muted' | 'warning';
  chevron?: boolean;
  open?: boolean;
}) {
  return (
    <button
      type="button"
      data-slot="composer-tool-button"
      data-tone={tone}
      data-popup-open={open ? '' : undefined}
      aria-expanded={open}
      className={cn(
        'flex h-[30px] shrink-0 items-center gap-[7px] rounded-sm px-2.5 text-sm tracking-[-0.006em] whitespace-nowrap outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring aria-expanded:bg-hover-surface data-popup-open:bg-hover-surface disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0',
        tone === 'default' && 'text-fg',
        tone === 'muted' && 'text-fg-muted',
        tone === 'warning' && 'text-warning',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="flex [&_svg:not([class*=size-])]:size-3.5 [&>[data-slot=agent-mark]]:text-inherit">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
      {chevron ? (
        <ChevronDownIcon className="size-3 opacity-60" strokeWidth={2.2} aria-hidden />
      ) : null}
    </button>
  );
}

/**
 * ComposerFile — one file a composer holds for the next message, as a 26px
 * chip on the control fill: its name, truncated past 220px, and the cross
 * that takes it off. `Composer` draws its attachments with it; a
 * `ChatComposer` whose files are not all images puts them in its
 * `attachments` slot.
 */
function ComposerFile({
  name,
  removeLabel,
  onRemove,
  className,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & {
  name: string;
  /** What a screen reader hears on the cross: "Remove trace.png". */
  removeLabel: string;
  onRemove?: () => void;
}) {
  return (
    <span
      data-slot="composer-file"
      className={cn(
        'flex h-[26px] max-w-[220px] items-center gap-1.5 rounded-sm bg-control pr-1 pl-2.25 text-xs text-fg-muted',
        className,
      )}
      {...props}
    >
      <span className="truncate">{name}</span>
      <button
        type="button"
        aria-label={removeLabel}
        title={removeLabel}
        onClick={onRemove}
        className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-sm transition-colors duration-fast hover:bg-hover-surface hover:text-fg"
      >
        <XIcon className="size-3" />
      </button>
    </span>
  );
}

export { Composer, ComposerChoices, ComposerFile, ComposerPill, ComposerToolButton };
export type { ComposerAttachment, ComposerLabels };
