import { cva } from "class-variance-authority";
import {
  CircleAlert,
  CircleCheck,
  type LucideIcon,
  TriangleAlert,
  X,
} from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * The callout box: a tonal fill, no hairline, a glyph in the tone's hue.
 * `Callout` is this with a sentence and nothing else; `Alert` adds a title
 * and, for a failure, its one action.
 */
type AlertTone = "neutral" | "info" | "success" | "warning" | "danger";

const alertVariants = cva(
  "grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 rounded-md px-3 py-2.5 text-left text-sm has-data-[slot=alert-action]:grid-cols-[auto_1fr_auto]",
  {
    variants: {
      tone: {
        neutral:
          "bg-hover-surface text-fg-muted *:data-[slot=alert-icon]:text-fg-subtle",
        info: "bg-info-surface text-fg *:data-[slot=alert-icon]:text-info",
        success:
          "bg-success-surface text-fg *:data-[slot=alert-icon]:text-success",
        warning:
          "bg-warning-surface text-fg *:data-[slot=alert-icon]:text-warning",
        danger: "bg-danger-surface text-fg *:data-[slot=alert-icon]:text-danger",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

const TONE_ICONS: Record<AlertTone, LucideIcon> = {
  neutral: CircleAlert,
  info: CircleAlert,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: X,
};

function Alert({
  className,
  tone = "neutral",
  icon,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  tone?: AlertTone;
  /** Overrides the tone's glyph. `null` renders none. */
  icon?: LucideIcon | null;
}) {
  const Glyph = icon === null ? null : (icon ?? TONE_ICONS[tone]);

  return (
    <div
      data-slot="alert"
      data-tone={tone}
      role={tone === "danger" || tone === "warning" ? "alert" : "note"}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      {Glyph ? (
        <span
          data-slot="alert-icon"
          aria-hidden
          className="row-span-2 mt-px flex shrink-0 [&_svg]:size-4"
        >
          <Glyph />
        </span>
      ) : null}
      {children}
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 font-medium text-fg [&_a]:underline [&_a]:underline-offset-3",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4",
        className,
      )}
      {...props}
    />
  );
}

/** A failure's one action (Dismiss, Retry). A note never takes one. */
function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn(
        "col-start-3 row-span-2 row-start-1 -my-1 self-start",
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertAction, AlertDescription, AlertTitle };
export type { AlertTone };
