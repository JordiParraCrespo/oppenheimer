import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

/**
 * Badge — a small pill marker. Beyond the shadcn set this carries the brand's
 * status tones: `count` is the blue count pill, `new` the pink attention
 * marker, and active/paused/ended/draft the tinted table status pills. Colour
 * on a badge is always a status signal, never decoration.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-4.5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 text-xs leading-none font-medium whitespace-nowrap transition-all] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-surface-hover",
        destructive:
          "bg-destructive/10 text-destructive [a]:hover:bg-destructive/[0.18]",
        outline:
          "border-border-default text-foreground [a]:hover:bg-surface-hover [a]:hover:text-foreground",
        ghost: "hover:bg-accent hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
        count: "h-4.5 min-w-4.5 border-0 bg-accent-blue px-1.5 text-white",
        new: "h-auto border-0 bg-transparent px-0 text-accent-pink",
        // The quiet chip: regular weight, secondary ink on the sunken well.
        neutral: "h-auto border-0 bg-surface-sunken px-2 py-0.5 font-normal text-ink-600",
        active: "h-auto border-0 bg-status-active-bg px-2.5 py-1 leading-[1.4] text-status-active",
        paused: "h-auto border-0 bg-status-paused-bg px-2.5 py-1 leading-[1.4] text-status-paused",
        ended: "h-auto border-0 bg-status-ended-bg px-2.5 py-1 leading-[1.4] text-status-ended",
        draft: "h-auto border-0 bg-status-draft-bg px-2.5 py-1 leading-[1.4] text-status-draft",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
