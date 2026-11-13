'use client';

import { ArrowUpIcon, PaperclipIcon } from 'lucide-react';
import type * as React from 'react';

import {
  ComposerFoot,
  ComposerFrame,
  ComposerRecorder,
  ComposerSendButton,
  assignRef,
  useComposerSend,
} from '../internal/composer-send';
import type { DictationSlot } from './chat-composer-extras';
import { cn } from '../lib/utils';
import { IconButton } from './icon-button';

type ChatComposerLabels = { send: string; stop: string; attach: string };

const DEFAULT_CHAT_COMPOSER_LABELS: ChatComposerLabels = {
  send: 'Send',
  stop: 'Stop',
  attach: 'Add images',
};

/**
 * ChatComposer — a bot's composer (Bots): a card at the 28px radius with no
 * border until it takes focus (the plain border then, no ring), its text at
 * 15px growing from two lines to eight, then a foot row: `tools` (the
 * approval level) on the left, `engine` (model, effort) on the right, and
 * the 34px send. While `busy` the send is the stop, a small square on the
 * ink. Enter sends, Shift+Enter makes a new line; `onAltSubmit` gives
 * Alt+Enter a second way to send (a bot's "queue it for after" while
 * Enter steers the turn under way), named for the caller to say, and
 * `onEmptyEnter` gives the caller Enter on a field with nothing to send (a
 * session's chat sends the first message waiting in its queue).
 *
 * It shares the send rules and the send button with `Composer`, the prompt
 * box: `sendBlockedReason` keeps the draft writable and the send off, and
 * says why; `above` fuses a notice or an approval onto its top edge, which
 * squares to meet it. `inputRef` is the textarea, for a caller that moves
 * focus into it (on open, after a suggestion fills it).
 *
 * `dictation` (`DictationSlot`) works as in `Composer`: the mic before send,
 * the recorder in the foot row's place while dictating, the notice under the
 * box. Enter while it records ends the recording and puts the caret after
 * what was said; the next Enter sends it.
 *
 * Files ride a message in either layout: `onAttach` puts the paperclip
 * first, in the foot row before `tools` (`stacked`) or at the start of the
 * row before the field (`inline`); `attachments` are what the message
 * carries, in a row over the text: a bot's `ChatImage` tiles, a session's
 * `ComposerFile` chips. `allowEmpty` lets a message of files alone be sent.
 *
 * `caption` is a quiet line inside the box over everything else: where the
 * field's text came from when it is not a draft ("History 1/2" while a bot's
 * sent messages are being stepped through). It is told to a screen reader as
 * it changes.
 */
function ChatComposer({
  value,
  onValueChange,
  onSubmit,
  onStop,
  onAltSubmit,
  onEmptyEnter,
  busy = false,
  disabled = false,
  sendBlockedReason,
  placeholder,
  tools,
  engine,
  above,
  caption,
  attachments,
  onAttach,
  allowEmpty = false,
  inputRef,
  dictation,
  labels,
  layout = 'stacked',
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onSubmit'> & {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop?: () => void;
  /** Alt+Enter: a second way to send, under the same rules as Enter. */
  onAltSubmit?: (value: string) => void;
  /** Enter with nothing to send: the caller's, in place of Stop. */
  onEmptyEnter?: () => void;
  busy?: boolean;
  disabled?: boolean;
  /** Why the draft cannot be sent yet, though it can be written. Present: send is off and says this. */
  sendBlockedReason?: string;
  placeholder?: string;
  /** Before the spacer: what the run may touch (the approval level). */
  tools?: React.ReactNode;
  /** After the spacer: who answers and how hard it thinks (model, effort). */
  engine?: React.ReactNode;
  /** A notice or an approval, fused to the field's top edge. */
  above?: React.ReactNode;
  /** A quiet line inside the box over the field: where its text came from. */
  caption?: React.ReactNode;
  /** The files the message carries (`ChatImage`s, `ComposerFile`s), in a row over the text. */
  attachments?: React.ReactNode;
  /** Present: shows the paperclip, first in the foot row (`stacked`) or the row (`inline`). */
  onAttach?: () => void;
  /** Send with nothing written: what is attached is the message. */
  allowEmpty?: boolean;
  inputRef?: React.Ref<HTMLTextAreaElement>;
  dictation?: DictationSlot;
  /** The icon buttons' accessible names; any left out stay in English. */
  labels?: Partial<ChatComposerLabels>;
  /**
   * `stacked` (a bot's chat): the field opens at two lines over a foot row
   * holding `tools`, `engine` and send. `inline` (a session read as a chat):
   * one row, the field opening at one line with send at its end, and `tools`
   * and `engine` as a quiet line under the box, so it does not crowd the
   * conversation above it.
   */
  layout?: 'stacked' | 'inline';
}) {
  const label = { ...DEFAULT_CHAT_COMPOSER_LABELS, ...labels };
  const { blocked, canSend, submit, onKeyDown, fieldRef } = useComposerSend({
    value,
    busy,
    disabled,
    sendBlockedReason,
    allowEmpty,
    onSubmit,
    onStop,
    onAltSubmit,
    onEmptyEnter,
    // While a recording is open, Enter ends it and sends nothing.
    settle: dictation?.recorder ? dictation.finish : undefined,
  });

  const inline = layout === 'inline';
  const field = (
    <textarea
      ref={(node) => {
        fieldRef.current = node;
        assignRef(inputRef, node);
      }}
      data-slot="chat-composer-input"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      rows={inline ? 1 : 2}
      // Grows with what is written, from its opening lines (`min-h`, since
      // `field-sizing-content` overrides `rows`) to eight, then scrolls.
      className={cn(
        'field-sizing-content max-h-52 w-full resize-none bg-transparent text-[15px] leading-[1.55] tracking-[-0.011em] text-fg outline-none placeholder:text-field-placeholder',
        inline ? cn('min-h-11 flex-1 py-2.5', onAttach ? 'pl-1' : 'pl-4.5') : 'min-h-18 px-5 pt-4 pb-2',
      )}
    />
  );
  const send = (
    <>
      {dictation?.mic ? <span className="ml-1 flex">{dictation.mic}</span> : null}
      <ComposerSendButton
        busy={busy}
        blocked={blocked}
        canSend={canSend}
        sendBlockedReason={sendBlockedReason}
        labels={label}
        onClick={submit}
        className={cn(
          inline ? 'ml-1 size-8' : 'ml-1 size-8.5',
          busy && 'bg-fg text-background hover:bg-fg hover:text-background',
        )}
      >
        {busy ? (
          <span aria-hidden className="size-2.25 rounded-[2px] bg-current" />
        ) : (
          <ArrowUpIcon className="size-4" strokeWidth={2.2} />
        )}
      </ComposerSendButton>
    </>
  );
  const paperclip = onAttach ? (
    <IconButton
      aria-label={label.attach}
      title={label.attach}
      size="sm"
      shape="square"
      onClick={onAttach}
      disabled={disabled}
      className={inline ? 'size-8' : 'size-7.5'}
    >
      <PaperclipIcon className="size-3.75" />
    </IconButton>
  ) : null;
  // The live region stays mounted, empty without a caption: a screen reader
  // reads a change inside a region it already knows, not one that arrives with its text.
  const captioned = (
    <div aria-live="polite">
      {caption ? (
        <div
          data-slot="chat-composer-caption"
          className={cn('text-xs text-fg-muted', inline ? 'px-3 pt-2.5' : '-mb-2 px-5 pt-3.5')}
        >
          {caption}
        </div>
      ) : null}
    </div>
  );
  const attached = attachments ? (
    <div
      data-slot="chat-composer-attachments"
      className={cn('flex flex-wrap gap-2.5', inline ? 'px-3 pt-3' : 'px-5 pt-4')}
    >
      {attachments}
    </div>
  ) : null;
  const recorder = dictation?.recorder ? (
    // The bar is 12px taller than the foot row it replaces; it takes
    // that from the field's bottom padding, so the box keeps its height.
    <ComposerRecorder
      data-slot="chat-composer-recorder"
      className={inline ? 'w-full' : '-mt-3 px-3 pb-3'}
      onEnter={submit}
    >
      {dictation.recorder}
    </ComposerRecorder>
  ) : null;

  const box = (
    <ComposerFrame above={above}>
      <div
        data-slot="chat-composer"
        data-layout={layout}
        data-disabled={disabled || undefined}
        data-above={above ? '' : undefined}
        className={cn(
          'flex rounded-xl border border-border-subtle bg-card transition-[border-color] duration-fast ease-standard has-focus-visible:border-border data-above:rounded-t-none data-above:border-t-border-subtle data-disabled:opacity-50',
          'flex-col',
          // Inline, the recorder bar is the box while it listens: one edge, not two.
          inline && recorder && 'border-transparent bg-transparent',
          className,
        )}
        {...props}
      >
        {inline ? (
          (recorder ?? (
            <>
              {captioned}
              {attached}
              <div className="flex items-end">
                {paperclip ? <span className="flex shrink-0 items-center p-1.5 pr-0">{paperclip}</span> : null}
                {field}
                <span className="flex shrink-0 items-center gap-1 p-1.5">{send}</span>
              </div>
            </>
          ))
        ) : (
          <>
            {captioned}
            {attached}
            {field}
            {recorder ?? (
              <ComposerFoot
                data-slot="chat-composer-foot"
                className="gap-1 px-3 pb-3"
                leading={
                  paperclip ? (
                    <>
                      {paperclip}
                      {tools}
                    </>
                  ) : (
                    tools
                  )
                }
                engine={engine}
              >
                {send}
              </ComposerFoot>
            )}
          </>
        )}
      </div>
      {inline && (tools || engine) ? (
        <div data-slot="chat-composer-meta" className="flex min-h-7 items-center gap-3 px-4.5 pt-1.5 text-[12.5px] text-fg-muted">
          {tools}
          <span className="ml-auto flex items-center gap-2">{engine}</span>
        </div>
      ) : null}
    </ComposerFrame>
  );
  if (!dictation?.notice) return box;
  return (
    <div data-slot="chat-composer-dictation" className="flex flex-col gap-2">
      {box}
      <div className="mx-5">{dictation.notice}</div>
    </div>
  );
}

export { ChatComposer };
export type { ChatComposerLabels };
