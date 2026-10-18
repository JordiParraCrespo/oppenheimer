'use client';

import { ArrowUpIcon } from 'lucide-react';
import type * as React from 'react';

import { ComposerFoot, ComposerFrame, ComposerSendButton, useComposerSend } from '../internal/composer-send';
import type { DictationSlot } from './chat-composer-extras';
import { cn } from '../lib/utils';

type ChatComposerLabels = { send: string; stop: string };

const DEFAULT_CHAT_COMPOSER_LABELS: ChatComposerLabels = { send: 'Send', stop: 'Stop' };

/**
 * ChatComposer — a bot's composer (Bots): a card at the 28px radius with no
 * border until it takes focus (the plain border then, no ring), its text at
 * 15px growing from two lines to eight, then a foot row: `tools` (the
 * approval level) on the left, `engine` (model, effort) on the right, and
 * the 34px send. While `busy` the send is the stop, a small square on the
 * ink. Enter sends, Shift+Enter makes a new line.
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
 */
function ChatComposer({
  value,
  onValueChange,
  onSubmit,
  onStop,
  busy = false,
  disabled = false,
  sendBlockedReason,
  placeholder,
  tools,
  engine,
  above,
  inputRef,
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
  placeholder?: string;
  /** Before the spacer: what the run may touch (the approval level). */
  tools?: React.ReactNode;
  /** After the spacer: who answers and how hard it thinks (model, effort). */
  engine?: React.ReactNode;
  /** A notice or an approval, fused to the field's top edge. */
  above?: React.ReactNode;
  inputRef?: React.Ref<HTMLTextAreaElement>;
  dictation?: DictationSlot;
  /** The send button's accessible names; any left out stay in English. */
  labels?: Partial<ChatComposerLabels>;
}) {
  const label = { ...DEFAULT_CHAT_COMPOSER_LABELS, ...labels };
  const { blocked, canSend, submit, onKeyDown } = useComposerSend({
    value,
    busy,
    disabled,
    sendBlockedReason,
    onSubmit,
    onStop,
  });

  const box = (
    <ComposerFrame above={above}>
      <div
        data-slot="chat-composer"
        data-disabled={disabled || undefined}
        data-above={above ? '' : undefined}
        className={cn(
          'flex flex-col rounded-xl border border-transparent bg-card transition-[border-color] duration-fast ease-standard has-focus-visible:border-border data-above:rounded-t-none data-above:border-t-border-subtle data-disabled:opacity-50',
          className,
        )}
        {...props}
      >
        <textarea
          ref={inputRef}
          data-slot="chat-composer-input"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          // Grows with what is written, from two lines (`min-h`, since
          // `field-sizing-content` overrides `rows`) to eight, then scrolls.
          className="field-sizing-content max-h-52 min-h-18 w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[15px] leading-[1.55] tracking-[-0.011em] text-fg outline-none placeholder:text-field-placeholder"
        />
        {dictation?.recorder ? (
          // The bar is 12px taller than the foot row it replaces; it takes
          // that from the field's bottom padding, so the box keeps its height.
          <div data-slot="chat-composer-recorder" className="-mt-3 px-3 pb-3">
            {dictation.recorder}
          </div>
        ) : (
          <ComposerFoot data-slot="chat-composer-foot" className="gap-1 px-3 pb-3" leading={tools}>
            {engine}
            {dictation?.mic ? <span className="ml-1 flex">{dictation.mic}</span> : null}
            <ComposerSendButton
              busy={busy}
              blocked={blocked}
              canSend={canSend}
              sendBlockedReason={sendBlockedReason}
              labels={label}
              onClick={submit}
              className={cn(
                'ml-1 size-8.5',
                busy && 'bg-fg text-background hover:bg-fg hover:text-background',
              )}
            >
              {busy ? (
                <span aria-hidden className="size-2.25 rounded-[2px] bg-current" />
              ) : (
                <ArrowUpIcon className="size-4" strokeWidth={2.2} />
              )}
            </ComposerSendButton>
          </ComposerFoot>
        )}
      </div>
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
