import { cva, type VariantProps } from "class-variance-authority";
import { CircleAlert, type LucideIcon, X } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";

/**
 * The export's callout (`Components.dc.html`, "Callout"), with room for a
 * title and one action: a flat tonal fill on a 14px radius, no hairline, 13px
 * text, a 16px glyph in the tone's hue. The ink stays `--fg` on the tinted
 * tone — only the glyph and the fill carry the signal.
 */
const alertVariants = cva(
  "group/alert relative grid grid-cols-[auto_1fr] gap-x-[9px] gap-y-0.5 rounded-md px-[13px] py-[11px] text-left text-[13px] leading-[1.45] has-data-[slot=alert-action]:grid-cols-[auto_1fr_auto]",
  {
    variants: {
      variant: {
        default:
          "bg-hover-surface text-fg-muted *:data-[slot=alert-icon]:text-fg-subtle",
        destructive:
          "bg-danger-surface text-fg *:data-[slot=alert-icon]:text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/** The export's glyph per tone: the alert disc for a note, a bare cross for an error. */
const VARIANT_ICONS: Record<
  NonNullable<VariantProps<typeof alertVariants>["variant"]>,
  LucideIcon
> = {
  default: CircleAlert,
  destructive: X,
};

function Alert({
  className,
  variant,
  icon,
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & {
    /** Overrides the variant's glyph. `null` renders none. */
    icon?: LucideIcon | null;
  }) {
  const LeadingIcon = icon === null ? null : (icon ?? VARIANT_ICONS[variant ?? "default"]);

  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {LeadingIcon ? (
        <span
          data-slot="alert-icon"
          aria-hidden
          className="row-span-2 mt-px flex shrink-0 [&_svg]:size-4"
        >
          <LeadingIcon />
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
