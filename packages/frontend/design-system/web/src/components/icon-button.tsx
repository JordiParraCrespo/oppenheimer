import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils';

/**
 * IconButton — a square footprint with a pill silhouette, on the same
 * 28 / 34 / 42 ramp as Button. Icon-only, so every instance needs an
 * `aria-label`, and normally a Tooltip.
 *
 * - `ghost` (default) — muted glyph, hover wash. The filter button in the
 *   sidebar header, the attach and mic buttons in the composer, the dialog close.
 * - `solid` — the neutral grey pill.
 * - `outline` — hairline on transparent.
 * - `primary` — the round blue send button.
 *
 * `shape="square"` swaps the pill for the 10px control radius, for buttons that
 * sit inside a field or a list header.
 */
const iconButtonVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-pill border border-transparent transition-[background-color,color,border-color,opacity,transform] duration-fast ease-standard outline-none select-none active:scale-[0.975] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        ghost: 'text-fg-muted hover:bg-hover-surface hover:text-fg active:bg-active-surface aria-expanded:bg-active-surface aria-expanded:text-fg',
        solid: 'bg-control text-control-fg hover:bg-control-hover active:bg-control-active',
        outline: 'border-border text-fg hover:bg-hover-surface',
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
        // Legacy alias.
        filled: 'bg-control text-control-fg hover:bg-control-hover active:bg-control-active',
      },
      size: {
        xs: 'size-6 rounded-sm [&_svg:not([class*=size-])]:size-3.5',
        sm: 'size-(--control-h-sm) [&_svg:not([class*=size-])]:size-3.5',
        md: 'size-(--control-h-md) [&_svg:not([class*=size-])]:size-4',
        lg: 'size-(--control-h-lg) [&_svg:not([class*=size-])]:size-[18px]',
        // Legacy alias.
        default: 'size-(--control-h-md) [&_svg:not([class*=size-])]:size-4',
      },
      shape: {
        pill: '',
        square: 'rounded-sm',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
      shape: 'pill',
    },
  },
);

type IconButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof iconButtonVariants> & {
    /** The button has no visible label: always pass one. */
    'aria-label'?: string;
  };

function IconButton({
  className,
  variant = 'ghost',
  size = 'md',
  shape = 'pill',
  render,
  nativeButton,
  ...props
}: IconButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="icon-button"
      data-variant={variant}
      data-size={size}
      className={cn(iconButtonVariants({ variant, size, shape, className }))}
      render={render}
      nativeButton={nativeButton ?? render === undefined}
      {...props}
    />
  );
}

export { IconButton, iconButtonVariants };
export type { IconButtonProps };
