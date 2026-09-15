"use client";

import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * MessageList — the scrolling column of message rows in the middle pane.
 *
 * Owns the scroll and the thin scrollbar; the rows own everything else. Give
 * it `flex-1 min-h-0` room from the pane around it, or the list will grow the
 * page instead of scrolling inside it.
 */
function MessageList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-list"
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-border-default [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-[9px]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * MessageListItem — one message: unread dot, avatar, sender over subject over
 * preview, and the time with its indicator icons on the right.
 *
 * Unread is the *lit* state, not the bold one alone — the row lifts to the
 * card white against the pane, takes the blue dot, and sets sender and subject
 * in medium. Three signals for one fact, because the row is scanned, not read.
 *
 * `avatar`, `tag` and `indicators` are slots so this component never has to
 * know about `Avatar`, `MailboxTag` or which icons mean what.
 */
function MessageListItem({
  avatar,
  from,
  tag,
  subject,
  preview,
  time,
  indicators,
  unread = false,
  selected = false,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "children"> & {
  avatar?: React.ReactNode;
  from: React.ReactNode;
  tag?: React.ReactNode;
  subject: React.ReactNode;
  preview?: React.ReactNode;
  time?: React.ReactNode;
  indicators?: React.ReactNode;
  unread?: boolean;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      data-slot="message-list-item"
      data-unread={unread || undefined}
      data-selected={selected || undefined}
      aria-current={selected || undefined}
      className={cn(
        "group/message flex w-full items-center gap-3 border-b border-border-subtle px-4 py-3 text-left transition-colors hover:bg-surface-hover",
        // Branched rather than stacked as two variants: `data-unread` and
        // `data-selected` are the same specificity, so which one won would
        // come down to their order in the generated stylesheet — and the open
        // message has to read as open whether or not it is also unread.
        selected ? "bg-focus-ring" : unread ? "bg-card" : undefined,
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="size-[7px] shrink-0 rounded-full bg-transparent group-data-unread/message:bg-accent-blue"
      />
      {avatar ? <span className="flex-none">{avatar}</span> : null}
      <span className="block min-w-0 flex-1 overflow-hidden">
        <span className="flex min-w-0 items-center gap-[9px] overflow-hidden">
          <span className="block max-w-[180px] shrink truncate text-base text-ink-900 group-data-unread/message:font-medium">
            {from}
          </span>
          {tag}
        </span>
        <span className="mt-[3px] block truncate text-base text-ink-900 group-data-unread/message:font-medium">
          {subject}
        </span>
        {preview ? (
          <span className="mt-0.5 block truncate text-sm text-ink-400">
            {preview}
          </span>
        ) : null}
      </span>
      <span className="flex min-w-[74px] flex-none flex-col items-end gap-1.5 pl-1.5">
        {time ? (
          <span className="text-xs whitespace-nowrap text-ink-400">{time}</span>
        ) : null}
        {indicators ? (
          <span className="flex items-center gap-1.5 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.25">
            {indicators}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export { MessageList, MessageListItem };
