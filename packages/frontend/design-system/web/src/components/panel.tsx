import type * as React from 'react';

import { cn } from '../lib/utils';
import { Card } from './card';

/**
 * Panel — a `Card` with a title row, for a titled block of a page: Path to
 * merge, Brief, Reviewers, each section of the review analytics. A 15px
 * medium title, an optional `meta` on its baseline at the right (mono for
 * a count, words for "vs last month"), then the content.
 */
function Panel({
  title,
  meta,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Card>, 'title'> & {
  title?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <Card data-slot="panel" className={cn('min-w-0 gap-4 overflow-visible px-5 py-4.5', className)} {...props}>
      {title || meta ? (
        <div className="flex items-baseline gap-2">
          {title ? <h2 className="m-0 text-body font-medium text-fg">{title}</h2> : null}
          <span className="flex-1" />
          {meta ? <span className="flex items-center gap-1.5 text-xs text-fg-muted">{meta}</span> : null}
        </div>
      ) : null}
      {children}
    </Card>
  );
}

/** Panels side by side, each at least 380px, as many as fit. */
function PanelGrid({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="panel-grid"
      className={cn('grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-stretch gap-3', className)}
      {...props}
    />
  );
}

export { Panel, PanelGrid };
