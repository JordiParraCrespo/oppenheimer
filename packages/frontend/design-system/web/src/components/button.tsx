import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/utils';

/**
 * Button — anything you press is a pill.
 *
 * One height ramp shared with Input and ChipSelect (28 / 34 / 42) so a row of
 * controls lines up without adjustment. Press is a `scale(.975)` over 80ms,
 * never a hue change. Disabled keeps the shape at 40% opacity.
 *
 * Variants, from the MVP screens:
 * - `primary` — the one blue per view. "Sign in", "Connect GitHub", "Start session".
 * - `secondary` — the neutral grey pill. "Resend link", "Copy", "New session" when
 *   the composer is already open.
 * - `ghost` — text only, hover wash. Toolbar and dialog dismissals.
 * - `outline` — hairline on transparent. Rare; kept for shadcn parity.
 * - `social` — the sign-in row: a lit `card` surface, hairline, 600 weight, an 18px
 *   brand glyph before the label (`BrandGlyph`). It sits on `card` rather than
 *   `control` so the providers read as the offer on the auth screens, the way the
 *   MVP artboards draw them, instead of as neutral secondary actions.
 * - `destructive` — red fill. "Stop run", "Log out" confirmations.
 *
 * It navigates, it is a `Link`; it acts, it is a `Button`. The one crossover is a
 * step's primary action that also routes ("Continue"): pass `render={<a />}` or
 * the router's link.
 */
const buttonVariants = cva(
  'group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-pill border border-transparent bg-transparent font-medium whitespace-nowrap transition-[background-color,color,border-color,opacity,transform] duration-fast ease-standard outline-none select-none active:scale-[0.975] active:duration-instant disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
        secondary: 'bg-control text-control-fg hover:bg-control-hover active:bg-control-active',
        ghost: 'text-fg hover:bg-hover-surface active:bg-active-surface aria-expanded:bg-hover-surface',
        outline:
          'border-border text-fg hover:border-border-strong hover:bg-hover-surface aria-expanded:bg-hover-surface',
        social:
          'gap-2.5 border-border bg-card font-semibold text-fg hover:border-border-strong hover:bg-card-hover active:bg-card-active',
        destructive: 'bg-danger text-white hover:brightness-[1.08]',
        // Legacy aliases from the starter's components; not part of the system.
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
        inverse: 'bg-fg text-fg-inverted hover:opacity-90',
        link: 'h-auto rounded-none px-0 text-link hover:underline',
      },
      size: {
        sm: 'h-(--control-h-sm) px-(--control-pad-sm) text-sm [&_svg:not([class*=size-])]:size-3.5',
        md: 'h-(--control-h-md) px-(--control-pad-md) text-operate [&_svg:not([class*=size-])]:size-4',
        lg: 'h-(--control-h-lg) px-(--control-pad-lg) text-lg [&_svg:not([class*=size-])]:size-[18px]',
        // Legacy aliases.
        default: 'h-(--control-h-md) px-(--control-pad-md) text-operate [&_svg:not([class*=size-])]:size-4',
        xs: 'h-6 px-2.5 text-xs [&_svg:not([class*=size-])]:size-3',
        icon: 'size-(--control-h-md) [&_svg:not([class*=size-])]:size-4',
        'icon-xs': 'size-6 [&_svg:not([class*=size-])]:size-3',
        'icon-sm': 'size-(--control-h-sm) [&_svg:not([class*=size-])]:size-3.5',
        'icon-lg': 'size-(--control-h-lg) [&_svg:not([class*=size-])]:size-[18px]',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;

function Button({
  className,
  variant = 'primary',
  size = 'md',
  block,
  render,
  nativeButton,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, block, className }))}
      render={render}
      nativeButton={nativeButton ?? render === undefined}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
