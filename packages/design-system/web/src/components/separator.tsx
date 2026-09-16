'use client';

import { Separator as SeparatorPrimitive } from '@base-ui/react/separator';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Separator — a 1px hairline in `--border-subtle`. Sections normally divide by
 * surface shift and whitespace, so a bare rule is rare; the labelled form is
 * the "OR" between the social buttons and the email form on sign in: the word
 * as an 11px uppercase eyebrow between two hairlines.
 */
function Separator({
  className,
  orientation = 'horizontal',
  children,
  ...props
}: SeparatorPrimitive.Props & { children?: React.ReactNode }) {
  if (children) {
    return (
      <div
        data-slot="separator"
        role="separator"
        aria-orientation="horizontal"
        className={cn('flex w-full items-center gap-3', className)}
      >
        <span className="h-px flex-1 bg-border-subtle" />
        <span className="eyebrow shrink-0 font-normal">{children}</span>
        <span className="h-px flex-1 bg-border-subtle" />
      </div>
    );
  }
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border-subtle data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:min-h-4 data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch',
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
