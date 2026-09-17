'use client';

import { ArrowUpIcon, MicIcon, PaperclipIcon, SquareIcon, XIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { IconButton } from './icon-button';

/**
 * Composer — the prompt box, the one place on New session with real presence:
 * an 18px-radius field holding a growing textarea, then a foot row with the
 * tools. Focus takes the blue border and ring. Enter submits, Shift+Enter
 * inserts a newline; while `busy` the send button becomes a stop button in the
 * same corner.
 *
 * Foot row, left to right: attach, `tools` (the model picker on the console),
 * a spacer, mic, and the round primary send. Attachments list under the
 * textarea as removable chips; they are never silently dropped.
 *
 * Controlled — own `value`, handle `onSubmit`.
 */
type ComposerAttachment = { id: string; name: string };

function Composer({
  value,
  onValueChange,
  onSubmit,
  onStop,
  busy = false,
  disabled = false,
  placeholder = 'Describe a task or ask a question',
  attachments,
  onRemoveAttachment,
  onAttach,
  onRecord,
  recording = false,
  tools,
  minRows = 3,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onSubmit'> & {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop?: () => void;
  busy?: boolean;
  disabled?: boolean;
  placeholder?: string;
  attachments?: ComposerAttachment[];
  onRemoveAttachment?: (id: string) => void;
  /** Present: shows the attach button. */
  onAttach?: () => void;
  /** Present: shows the mic button. */
  onRecord?: () => void;
  recording?: boolean;
  /** Extra controls in the foot row, e.g. the model picker. */
  tools?: React.ReactNode;
  minRows?: number;
}) {
  const canSend = value.trim().length > 0 && !disabled;

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

  return (
    <div
      data-slot="composer"
      className={cn(
        'flex flex-col rounded-lg border border-field-border bg-field transition-[border-color,box-shadow] duration-fast ease-standard has-focus-visible:border-primary has-focus-visible:ring-3 has-focus-visible:ring-ring has-disabled:opacity-50',
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
        className="field-sizing-content max-h-[40svh] w-full resize-none bg-transparent px-[18px] pt-4 pb-2 text-lg leading-normal text-fg outline-none placeholder:text-field-placeholder"
      />
      {attachments && attachments.length > 0 ? (
        <div data-slot="composer-attachments" className="flex flex-wrap gap-1.5 px-3 pb-2.5">
          {attachments.map((file) => (
            <span
              key={file.id}
              className="flex h-[26px] max-w-[220px] items-center gap-1.5 rounded-sm bg-control pr-1 pl-2.5 text-xs text-fg-muted"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => onRemoveAttachment?.(file.id)}
                className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-sm transition-colors duration-fast hover:bg-hover-surface hover:text-fg"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div data-slot="composer-foot" className="flex items-center gap-1.5 px-2.5 pb-2.5">
        {onAttach ? (
          <IconButton aria-label="Attach a file" size="sm" shape="square" onClick={onAttach}>
            <PaperclipIcon />
          </IconButton>
        ) : null}
        {tools}
        <span className="flex-1" />
        {onRecord ? (
          <IconButton
            aria-label={recording ? 'Stop recording' : 'Dictate'}
            aria-pressed={recording}
            size="sm"
            shape="square"
            onClick={onRecord}
            className={cn(recording && 'bg-danger-surface text-danger hover:bg-danger-surface hover:text-danger')}
          >
            <MicIcon />
          </IconButton>
        ) : null}
        <IconButton
          aria-label={busy ? 'Stop' : 'Send'}
          variant="primary"
          size="sm"
          onClick={submit}
          disabled={!busy && !canSend}
          className="size-8"
        >
          {busy ? <SquareIcon className="size-3.5 fill-current" /> : <ArrowUpIcon strokeWidth={2.5} />}
        </IconButton>
      </div>
    </div>
  );
}

export { Composer };
export type { ComposerAttachment };
