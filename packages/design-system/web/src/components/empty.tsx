import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Empty — an empty state names the next action: a muted description and one
 * button, optionally under a title and a 44px icon disc. `compact` is the
 * sidebar form ("No sessions yet. The one you start appears here with its live
 * state."): left-aligned, 12.5px, no disc.
 */
function Empty({
  className,
  compact,
  ...props
}: React.ComponentProps<'div'> & { compact?: boolean }) {
  return (
    <div
      data-slot="empty"
      data-compact={compact || undefined}
      className={cn(
        'group/empty flex min-w-0 flex-1 flex-col items-center justify-center gap-2.5 px-6 py-20 text-center text-balance',
        compact && 'items-start gap-1.5 px-3 py-3.5 text-left text-pretty',
        className,
      )}
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-header"
      className={cn(
        'flex max-w-[42ch] flex-col items-center gap-1 text-center group-data-compact/empty:items-start group-data-compact/empty:text-left',
        className,
      )}
      {...props}
    />
  );
}

const emptyMediaVariants = cva(
  'mb-1 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: 'size-11 rounded-pill bg-control text-fg-subtle [&_svg:not([class*=size-])]:size-5',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function EmptyMedia({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-media"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-title"
      className={cn('text-h4 font-semibold text-fg', className)}
      {...props}
    />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="empty-description"
      className={cn('text-operate text-fg-muted [[data-compact]_&]:text-[12.5px] [[data-compact]_&]:leading-normal [[data-compact]_&]:text-fg-subtle', className)}
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-content"
      className={cn('mt-2 flex w-full min-w-0 flex-col items-center gap-3', className)}
      {...props}
    />
  );
}

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle };
