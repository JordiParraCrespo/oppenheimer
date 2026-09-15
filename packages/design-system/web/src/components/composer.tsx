"use client";

import { ArrowUpIcon, SquareIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";

/**
 * Composer — the assistant's input: a card-radius well holding an
 * auto-growing textarea over a toolbar row, with the blue circular send button
 * pinned right. Enter submits; Shift+Enter inserts a newline.
 *
 * While `busy`, the send button becomes a stop button — the same corner, so a
 * reader who wants to interrupt does not have to find a new control, and the
 * field stays live so the next question can be typed while this one finishes.
 *
 * Controlled — own the value and handle `onSubmit`.
 */
function Composer({
  value,
  onValueChange,
  onSubmit,
  onStop,
  busy = false,
  placeholder = "Ask anything…",
  sendLabel = "Send",
  stopLabel = "Stop",
  toolbar,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onSubmit"> & {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit?: () => void;
  /** Called by the stop button. Only reachable while `busy`. */
  onStop?: () => void;
  /** A turn is in flight. */
  busy?: boolean;
  placeholder?: string;
  /** Accessible names for the one button that changes meaning — pass translated copy. */
  sendLabel?: string;
  stopLabel?: string;
  toolbar?: React.ReactNode;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Grow with the content, capped so the thread above stays visible.
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Floored at one comfortable line so the field never shrinks below its
    // resting height, capped so a long draft cannot swallow the thread above.
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 22), 120)}px`;
  }, [value]);

  const canSend = value.trim().length > 0;

  return (
    <div
      data-slot="composer"
      className={cn(
        "rounded-2xl border border-border-default bg-card px-3 pt-3 pb-2.5 transition-[border-color,box-shadow]",
        // The whole well takes the focus ring, not the bare textarea inside it
        // — the field carries no border of its own, so a ring on the control
        // would draw a rectangle floating in the middle of a card.
        "focus-within:border-accent-blue focus-within:ring-3 focus-within:ring-focus-ring",
        className,
      )}
      {...props}
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (canSend) onSubmit?.();
          }
        }}
        className="max-h-30 w-full resize-none bg-transparent text-base leading-[1.45] text-ink-900 outline-none placeholder:text-ink-400 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      />
      <div className="mt-2 flex items-center gap-2">
        {toolbar}
        <span className="flex-1" />
        <button
          type="button"
          disabled={!busy && !canSend}
          onClick={() => (busy ? onStop?.() : onSubmit?.())}
          aria-label={busy ? stopLabel : sendLabel}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-blue text-white transition-[opacity,transform] hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-400 disabled:hover:opacity-100"
        >
          {busy ? (
            <SquareIcon className="size-3 fill-current" />
          ) : (
            <ArrowUpIcon className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export { Composer };
