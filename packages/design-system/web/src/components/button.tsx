import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

/**
 * The brand ships exactly one CTA shape: a pill. Primary is the warm near-black
 * fill with white text; `outline` is the white/hairline secondary; `inverse` is
 * the white pill used on dark cards. Press is a 0.98 scale — never a colour
 * inversion. Labels are sentence case and verb-first ("Connect device").
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-base leading-none font-medium whitespace-nowrap transition-all outline-none select-none active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border-border-default bg-card text-foreground hover:border-border-strong hover:bg-surface-hover aria-expanded:bg-surface-hover",
        // The brand has exactly two CTA fills: the near-black primary and this
        // white-with-a-hairline secondary. `outline` is kept as an alias of it
        // for shadcn familiarity — they are deliberately the same thing.
        secondary:
          "border-border-default bg-card text-foreground hover:border-border-strong hover:bg-surface-hover aria-expanded:bg-surface-hover",
        inverse: "bg-card text-ink-900 hover:bg-card/90",
        ghost: "text-foreground hover:bg-accent aria-expanded:bg-accent",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/[0.18] focus-visible:border-destructive/40",
        link: "rounded-none text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-2 px-5.5 has-data-[icon=inline-end]:pr-4.5 has-data-[icon=inline-start]:pl-4.5",
        xs: "h-6 gap-1 px-3 text-xs has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1.5 px-3.5 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-6 has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "lg",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      render={render}
      nativeButton={nativeButton ?? (render === undefined ? true : false)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
