"use client";

import { XIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * MailboxTag — the quiet pill naming the mailbox a message arrived in, with
 * that mailbox's purpose dot in front of it. Sits inside a message row and in
 * the reading pane's header.
 *
 * Read-only by design. This is a label, not a control: the thing that *picks*
 * mailboxes is `MailboxPicker`, and the removable form is `MailboxChip`.
 */
function MailboxTag({
  tone,
  children,
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: string }) {
  return (
    <span
      data-slot="mailbox-tag"
      className={cn(
        "inline-flex shrink-0 items-center gap-[5px] rounded-full border border-border-subtle bg-surface-sunken px-2 py-0.5 text-[11.5px] whitespace-nowrap text-ink-600",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="inline-block size-1.5 shrink-0 rounded-full bg-ink-400"
        style={tone ? { background: tone } : undefined}
      />
      {children}
    </span>
  );
}

/**
 * MailboxChip — one mailbox in the toolbar's "currently filtering by" row,
 * with the control that drops it.
 *
 * The chip is a `span` holding a `button`, not a button itself: the whole chip
 * is not clickable, only the ✕ is, and a nested button would be invalid markup
 * as well as a confusing target.
 */
function MailboxChip({
  tone,
  onRemove,
  removeLabel = "Remove",
  children,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  tone?: string;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <span
      data-slot="mailbox-chip"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-sunken py-1 pr-1.5 pl-2.5 text-xs whitespace-nowrap text-ink-900",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full bg-ink-400"
        style={tone ? { background: tone } : undefined}
      />
      {children}
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className="inline-flex size-[17px] shrink-0 items-center justify-center rounded-full hover:bg-surface-hover"
        >
          <XIcon className="size-2.75 text-ink-400" />
        </button>
      ) : null}
    </span>
  );
}

export { MailboxChip, MailboxTag };
