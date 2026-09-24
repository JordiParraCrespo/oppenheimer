import { cva, type VariantProps } from "class-variance-authority";
import {
  CircleAlert,
  CircleCheck,
  CirclePause,
  CircleX,
  Info,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-2xl border px-4 py-3 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        // The failure callout, on the same terms as the status ones below: the
        // hairline takes the destructive hue so the edge reads as an error
        // rather than as a plain card that happens to hold red text. It was
        // the one variant left on the neutral `border-border`, which is why a
        // failed sign-in looked like an unstyled box.
        destructive:
          "border-destructive/25 bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
        // Status callouts, mirroring Badge's vocabulary. The surface stays the
        // flat card and only the ink carries the signal — a full-bleed tint at
        // this size would be decoration, which the brand does not do. The
        // hairline picks up the status hue so the edge reads without shouting.
        active:
          "border-status-active/25 bg-card text-status-active *:data-[slot=alert-description]:text-status-active/90 *:[svg]:text-current",
        paused:
          "border-status-paused/25 bg-card text-status-paused *:data-[slot=alert-description]:text-status-paused/90 *:[svg]:text-current",
        ended:
          "border-status-ended/25 bg-card text-status-ended *:data-[slot=alert-description]:text-status-ended/90 *:[svg]:text-current",
        draft:
          "border-status-draft/25 bg-card text-status-draft *:data-[slot=alert-description]:text-status-draft/90 *:[svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/**
 * The leading icon each variant wears when the caller does not name one.
 *
 * An alert without an icon is a box of coloured text, which is what every
 * error callout in the product was until these became the default — the icon
 * was optional, so all 47 of them went without. `destructive` takes the alert
 * disc rather than `ended`'s cross: one is a failure to act on, the other a
 * state something has settled into, and they share a colour.
 */
const VARIANT_ICONS: Record<
  NonNullable<VariantProps<typeof alertVariants>["variant"]>,
  LucideIcon
> = {
  default: CircleAlert,
  destructive: CircleAlert,
  active: CircleCheck,
  paused: CirclePause,
  ended: CircleX,
  draft: Info,
};

function Alert({
  className,
  variant,
  icon,
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & {
    /**
     * Overrides the variant's leading icon. `null` renders none — for the rare
     * callout that is one line inside something already labelled. A prop
     * rather than a child, because a child is the half nobody remembers to
     * pass.
     */
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
      {LeadingIcon ? <LeadingIcon /> : null}
      {children}
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "cn-font-heading font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
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
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
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
      className={cn("absolute top-2.5 right-3", className)}
      {...props}
    />
  );
}

export { Alert, AlertAction, AlertDescription, AlertTitle };
