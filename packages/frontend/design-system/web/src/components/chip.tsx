import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Chip — a chosen value or a filter: 28px pill, 13px medium, hairline border.
 * Clicks, toggles, dismisses. A leading icon (or check) sits in front of the
 * label; `selected` takes the blue tint; `solid` is the neutral filled form.
 *
 * Renders a button when it has `onClick`, otherwise a span, so the read-only
 * capability chips on Add host ("✓ git") are not announced as controls.
 */
const chipVariants = cva(
  'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-pill border px-2.5 text-sm font-medium whitespace-nowrap text-fg transition-[background-color,color,border-color] duration-fast ease-standard outline-none select-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-3.5',
  {
    variants: {
      variant: {
        outline: 'border-border bg-transparent',
        solid: 'border-transparent bg-control text-control-fg',
      },
      interactive: {
        true: 'cursor-pointer hover:bg-hover-surface data-selected:border-transparent data-selected:bg-selected-surface data-selected:text-link',
        false: 'data-selected:border-transparent data-selected:bg-selected-surface data-selected:text-link',
      },
    },
    defaultVariants: {
      variant: 'outline',
      interactive: false,
    },
  },
);

type ChipProps = Omit<VariantProps<typeof chipVariants>, 'interactive'> & {
  selected?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
} & (
    | ({ onClick: React.MouseEventHandler<HTMLButtonElement> } & Omit<
        ButtonPrimitive.Props,
        'className' | 'children' | 'onClick'
      >)
    | ({ onClick?: undefined } & Omit<React.ComponentProps<'span'>, 'className' | 'children'>)
  );

function Chip({ className, variant, selected, icon, children, ...props }: ChipProps) {
  const classes = cn(
    chipVariants({ variant, interactive: props.onClick !== undefined }),
    className,
  );
  if (props.onClick !== undefined) {
    const { onClick, ...rest } = props;
    return (
      <ButtonPrimitive
        data-slot="chip"
        data-selected={selected || undefined}
        aria-pressed={selected}
        className={classes}
        onClick={onClick}
        {...rest}
      >
        {icon}
        {children}
      </ButtonPrimitive>
    );
  }
  const { onClick: _, ...rest } = props;
  return (
    <span data-slot="chip" data-selected={selected || undefined} className={classes} {...rest}>
      {icon}
      {children}
    </span>
  );
}

/**
 * FilterChip — the summary of an active filter under the sessions header:
 * 22px, neutral fill, 10px radius, a remove button. What the menu is currently
 * hiding, stated plainly so a filtered list never looks like an empty one.
 */
function FilterChip({
  className,
  children,
  onRemove,
  removeLabel = 'Clear filter',
  ...props
}: React.ComponentProps<'span'> & {
  onRemove: () => void;
  removeLabel?: string;
}) {
  return (
    <span
      data-slot="filter-chip"
      className={cn(
        'inline-flex h-[22px] items-center gap-1.25 rounded-sm bg-control pr-1 pl-2 text-[11.5px] leading-none text-fg',
        className,
      )}
      {...props}
    >
      <span className="truncate">{children}</span>
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className="inline-flex size-[15px] shrink-0 items-center justify-center rounded-[3px] text-fg-muted transition-colors duration-fast hover:bg-hover-surface hover:text-fg"
      >
        <XIcon className="size-3" />
      </button>
    </span>
  );
}

export { Chip, FilterChip, chipVariants };
export type { ChipProps };
