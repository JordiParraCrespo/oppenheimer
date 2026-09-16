import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Card — the content container: 18px radius, a hairline in `--border-subtle`,
 * the lit surface on the canvas, and **no shadow**. Depth is tonal: white on
 * `#f5f5f7`, `#1a1a1c` on `#121213`. A drop shadow on a card is the fastest
 * way to make this system look cheap.
 *
 * `padded` puts the 24px card padding on the card itself for a single block of
 * content (the CodeBlock cards on Add host); otherwise use the header, content
 * and footer parts, which carry their own.
 */
function Card({
  className,
  padded,
  interactive,
  size: _size,
  ...props
}: React.ComponentProps<'div'> & {
  padded?: boolean;
  /** Border darkens on hover. Never a shadow. */
  interactive?: boolean;
  /** Legacy, ignored. */
  size?: 'default' | 'sm';
}) {
  return (
    <div
      data-slot="card"
      className={cn(
        'group/card flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-card text-card-foreground shadow-none',
        padded && 'p-(--card-padding)',
        interactive && 'cursor-pointer transition-colors duration-fast hover:border-border-strong',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'flex items-start justify-between gap-4 px-(--card-padding) pt-5 has-data-[slot=card-description]:flex-col has-data-[slot=card-description]:gap-0.5 has-data-[slot=card-action]:flex-row',
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('text-h4 font-semibold text-fg', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-sm text-fg-muted', className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-action" className={cn('ml-auto shrink-0', className)} {...props} />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('px-(--card-padding) pt-5 pb-(--card-padding)', className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'flex items-center gap-2 border-t border-border-subtle px-(--card-padding) py-3',
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
