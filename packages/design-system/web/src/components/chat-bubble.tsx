import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * ChatBubble — one turn in the assistant thread. The user's turn is the dark
 * inverse fill, right-aligned; the assistant's is a white card with a hairline,
 * led by its mark. 14px at 1.55 line-height, capped at 82% of the rail.
 *
 * Who is speaking is `from`, not `role`: this renders a `div`, and a prop
 * called `role` on a `div` is an ARIA role to every linter that looks at the
 * JSX — `role="assistant"` failed `useValidAriaRole` at every call site.
 */
function ChatBubble({
  from,
  avatar,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  from: "user" | "assistant";
  avatar?: React.ReactNode;
}) {
  const isUser = from === "user";

  return (
    <div
      data-slot="chat-bubble"
      data-role={from}
      className={cn("flex gap-2.5", isUser && "flex-row-reverse", className)}
      {...props}
    >
      {avatar ? <span className="shrink-0">{avatar}</span> : null}
      <div
        className={cn(
          "max-w-[82%] rounded-[14px] text-base leading-[1.55] whitespace-pre-wrap",
          isUser
            ? "bg-surface-inverse px-3.5 py-2.5 text-on-inverse"
            : "border border-border-subtle bg-card px-3.5 py-3 text-ink-900",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** The assistant's mark plate — a 28px tiled square beside its bubbles. */
function ChatMark({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="chat-mark"
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-card [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

/** The three-dot typing indicator shown while a reply streams. */
function ChatTyping({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="chat-typing"
      aria-label="Assistant is typing"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 animate-bounce rounded-full bg-ink-400 motion-reduce:animate-none"
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
    </span>
  );
}

export { ChatBubble, ChatMark, ChatTyping };
