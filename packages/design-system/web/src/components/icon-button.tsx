import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

/**
 * IconButton — a single line icon in a 32px pill. Used for toolbar actions,
 * the "+" add control, and chrome buttons that carry no label.
 *
 * Distinct from `Button size="icon"`, which matches the text button's 36px box
 * so it can sit in a row of CTAs. This one is the smaller standalone control
 * the brand uses on cards and in dense toolbars, and it presses 0.96 rather
 * than 0.98 — a small control needs a slightly larger cue to read.
 */
const iconButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full border text-ink-900 transition-all outline-none select-none active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        outline:
          "border-border-default bg-card hover:border-border-strong hover:bg-surface-hover",
        ghost: "border-transparent bg-transparent hover:bg-surface-hover",
        filled: "border-transparent bg-surface-sunken hover:bg-surface-hover",
      },
      size: {
        default: "size-8",
        sm: "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "size-11 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "lg",
    },
  },
);

function IconButton({
  className,
  variant = "outline",
  size = "default",
  render,
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof iconButtonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="icon-button"
      className={cn(iconButtonVariants({ variant, size, className }))}
      render={render}
      nativeButton={nativeButton ?? (render === undefined ? true : false)}
      {...props}
    />
  );
}

export { IconButton, iconButtonVariants };
