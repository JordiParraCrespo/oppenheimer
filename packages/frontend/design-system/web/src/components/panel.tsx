import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Panel — a titled block of a page on the card: Path to merge, Brief,
 * Reviewers, each section of the review analytics. A 15px medium title, an
 * optional `meta` on its baseline at the right (mono for a count, words for
 * "vs last month"), then the content.
 * The `Card` contract: 18px radius, the subtle hairline, no shadow.
 */
function Panel({
  title,
  meta,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'section'>, 'title'> & {
  title?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <section
      data-slot="panel"
      className={cn('flex min-w-0 flex-col gap-4 rounded-lg border border-border-subtle bg-card px-5 py-4.5', className)}
      {...props}
    >
      {title || meta ? (
        <div className="flex items-baseline gap-2">
          {title ? <h2 className="m-0 text-body font-medium text-fg">{title}</h2> : null}
          <span className="flex-1" />
          {meta ? <span className="flex items-center gap-1.5 text-xs text-fg-muted">{meta}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
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
