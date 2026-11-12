'use client';

import { ArrowUpIcon, PaperclipIcon } from 'lucide-react';
import * as React from 'react';

import {
  ComposerFoot,
  ComposerFrame,
  ComposerRecorder,
  ComposerSendButton,
  useComposerSend,
} from '../internal/composer-send';
import type { DictationSlot } from './chat-composer-extras';
import { cn } from '../lib/utils';
import { ChatCommand } from './chat-transcript';
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
 * Enter steers the turn under way), named for the caller to say.
 *
 * It shares the send rules and the send button with `Composer`, the prompt
 * box: `sendBlockedReason` keeps the draft writable and the send off, and
 * says why; `above` fuses a notice or an approval onto its top edge, which
 * squares to meet it. `inputRef` is the textarea, for a caller that moves
 * focus into it (on open, after a suggestion fills it).
 *
 * `dictation` (`DictationSlot`) works as in `Composer`: the mic before send,
 * the recorder in the foot row's place while dictating, the notice under the
 * box.
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
  command,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onSubmit'> & {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop?: () => void;
  /** Alt+Enter: a second way to send, under the same rules as Enter. */
  onAltSubmit?: (value: string) => void;
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
  /**
   * The `/command` the text starts with, marked the way a sent message marks
   * it (`ChatCommand`) while it is written. A prefix of `value`; anything
   * else is ignored.
   */
  command?: string;
}) {
  const label = { ...DEFAULT_CHAT_COMPOSER_LABELS, ...labels };
  const { blocked, canSend, submit, onKeyDown } = useComposerSend({
    value,
    busy,
    disabled,
    sendBlockedReason,
    allowEmpty,
    onSubmit,
    onStop,
    onAltSubmit,
    // While a recording is open, a send waits for what is still being heard.
    beforeSend: dictation?.recorder ? dictation.finish : undefined,
  });

  const inline = layout === 'inline';
  const backdrop = React.useRef<HTMLDivElement>(null);
  const marked = command && value.startsWith(command) ? command : undefined;
  // One box for the text, in the textarea and the backdrop under it alike, so the two lay out the same.
  const textBox = cn(
    'w-full text-[15px] leading-[1.55] tracking-[-0.011em]',
    inline ? cn('min-h-11 py-2.5 pr-0', onAttach ? 'pl-1' : 'pl-4.5') : 'min-h-18 px-5 pt-4 pb-2',
    // A long draft scrolls, and its scrollbar takes width the backdrop has
    // none of; both keep its gutter, so their lines wrap at the same place.
    marked && '[scrollbar-gutter:stable]',
  );
  const textarea = (
    <textarea
      ref={inputRef}
      data-slot="chat-composer-input"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      onKeyDown={onKeyDown}
      onScroll={(event) => {
        if (backdrop.current) backdrop.current.scrollTop = event.currentTarget.scrollTop;
      }}
      placeholder={placeholder}
      disabled={disabled}
      rows={inline ? 1 : 2}
      // Grows with what is written, from its opening lines (`min-h`, since
      // `field-sizing-content` overrides `rows`) to eight, then scrolls.
      className={cn(
        'field-sizing-content relative max-h-52 resize-none bg-transparent text-fg outline-none placeholder:text-field-placeholder',
        textBox,
        // With a command marked, the backdrop draws the words and the textarea only the caret and the selection.
        marked && 'text-transparent caret-fg',
      )}
    />
  );
  // A textarea cannot colour part of its text, so a marked command is drawn
  // by a copy of the text under it, scrolled with it. The wrapper stays put
  // either way, so the textarea keeps focus as a command comes and goes.
  const field = (
    <div data-slot="chat-composer-field" className={cn('relative grid', inline && 'flex-1')}>
      {marked ? (
        <div
          ref={backdrop}
          aria-hidden
          data-slot="chat-composer-backdrop"
          className={cn(
            'pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap wrap-break-word text-fg',
            textBox,
          )}
        >
          <ChatCommand>{marked}</ChatCommand>
          {value.slice(marked.length)}
          {/* A final newline takes a line in the textarea; this keeps the copy as tall. */}
          {value.endsWith('\n') ? ' ' : null}
        </div>
      ) : null}
      {textarea}
    </div>
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
