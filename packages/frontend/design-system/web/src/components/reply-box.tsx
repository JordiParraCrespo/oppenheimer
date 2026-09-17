"use client";

import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * ReplyBox — the reply well at the foot of a message: a card-radius frame
 * holding a plain textarea over a sunken toolbar strip.
 *
 * Distinct from `Composer`, which is the assistant's input — auto-growing, one
 * blue circular send, Enter submits. A reply is a letter, not a prompt: it is
 * multi-paragraph by default, Enter has to insert a newline, and the send
 * control is the workspace's ordinary CTA. Sharing one component would mean a
 * flag on every one of those differences.
 *
 * Controlled: own `value`, handle `onValueChange`. `toolbar` fills the left of
 * the footer strip (attach, draft-with-AI), `actions` the right (send).
 */
function ReplyBox({
  value,
  onValueChange,
  placeholder,
  toolbar,
  actions,
  className,
  textareaClassName,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  toolbar?: React.ReactNode;
  actions?: React.ReactNode;
  textareaClassName?: string;
}) {
  return (
    <div
      data-slot="reply-box"
      className={cn(
        "mt-[22px] overflow-hidden rounded-2xl border border-border-default",
        className,
      )}
      {...props}
    >
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(
          "min-h-[88px] w-full resize-none bg-transparent p-3.25 text-base leading-normal text-ink-900 outline-none placeholder:text-ink-400",
          textareaClassName,
        )}
      />
      <div className="flex items-center gap-2 border-t border-border-subtle bg-surface-sunken px-2.75 py-2.25">
        {toolbar}
        <span className="flex-1" />
        {actions}
      </div>
    </div>
  );
}

export { ReplyBox };
