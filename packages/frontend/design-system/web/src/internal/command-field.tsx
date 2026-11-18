'use client';

import * as React from 'react';

import { ChatCommandText } from '../components/chat-transcript';
import { cn } from '../lib/utils';

/**
 * A composer's textarea that can mark the `/command` its text starts with.
 * A textarea cannot colour part of its text, so while `command` is a prefix
 * of `value` a copy of the text is drawn under it (`ChatCommandText`, as a
 * sent message draws it), scrolled with it, and the textarea's own words go
 * transparent, leaving it the caret and the selection. `box` is the text box
 * the two share (padding, type, minimum height), so they lay out alike.
 *
 * The wrapper stays put whether or not a command is marked, so the textarea
 * is never remounted and keeps focus as a command comes and goes.
 */
export function CommandField({
  command,
  box,
  inputRef,
  wrapperClassName,
  className,
  onScroll,
  ...props
}: React.ComponentProps<'textarea'> & {
  value: string;
  command?: string;
  box: string;
  inputRef?: React.Ref<HTMLTextAreaElement>;
  wrapperClassName?: string;
}) {
  const backdrop = React.useRef<HTMLDivElement>(null);
  const marked = command && props.value.startsWith(command) ? command : undefined;
  // A long draft scrolls, and its scrollbar takes width the backdrop has
  // none of; both keep its gutter, so their lines wrap at the same place.
  const shared = cn(box, marked && '[scrollbar-gutter:stable]');
  return (
    <div data-slot="chat-composer-field" className={cn('relative grid', wrapperClassName)}>
      {marked ? (
        <div
          ref={backdrop}
          aria-hidden
          data-slot="chat-composer-backdrop"
          className={cn(
            'pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap wrap-break-word text-fg',
            shared,
          )}
        >
          <ChatCommandText text={props.value} command={marked} />
          {/* A final newline takes a line in the textarea; this keeps the copy as tall. */}
          {props.value.endsWith('\n') ? ' ' : null}
        </div>
      ) : null}
      <textarea
        ref={inputRef}
        onScroll={(event) => {
          if (backdrop.current) backdrop.current.scrollTop = event.currentTarget.scrollTop;
          onScroll?.(event);
        }}
        className={cn('relative', className, shared, marked && 'text-transparent caret-fg')}
        {...props}
      />
    </div>
  );
}
