import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * TemplateGrid — starting points under the routine table: a two-column
 * grid (one column under 320px) of items, each a 36px round glyph on the
 * card colour, a name, a two-line description, a meta line naming the
 * trigger, and an Add button. Items take the hover wash on a 14px radius.
 */
function TemplateGrid({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="template-grid"
      className={cn('grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-x-4 gap-y-1', className)}
      {...props}
    />
  );
}

function TemplateItem({
  icon,
  name,
  description,
  meta,
  action,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  icon: React.ReactNode;
  name: React.ReactNode;
  description: React.ReactNode;
  /** The trigger, with its glyph ("On pull request opened"). */
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="template-item"
      className={cn(
        'flex items-center gap-3 rounded-md p-2.5 transition-colors duration-fast hover:bg-hover-surface',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-card text-fg [&_svg:not([class*=size-])]:size-4"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-fg">{name}</span>
        <span className="line-clamp-2 text-[12.5px] leading-[1.4] text-fg-muted">{description}</span>
        {meta ? (
          <span className="mt-0.5 flex items-center gap-[5px] text-xs text-fg-subtle [&_svg:not([class*=size-])]:size-3">
            {meta}
          </span>
        ) : null}
      </span>
      {action ? <span className="shrink-0">{action}</span> : null}
    </div>
  );
}

/**
 * TemplateTiles — starting points picked by clicking the whole tile (a new
 * bot's Blank, GitHub, Sessions, Plan): as many 150px columns as fit, 8px
 * apart. Each `TemplateTile` is a button on the card at the 18px radius, its
 * glyph in muted ink over the name at 14px medium and a 12.5px line; the
 * pointer takes it to the control's hover grey. `TemplateGrid` stays for
 * templates read before they are added (the automations'), with their trigger
 * and an Add button.
 */
function TemplateTiles({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="template-tiles"
      className={cn('grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2', className)}
      {...props}
    />
  );
}

function TemplateTile({
  icon,
  name,
  description,
  className,
  ...props
}: Omit<React.ComponentProps<'button'>, 'type' | 'children'> & {
  icon: React.ReactNode;
  name: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-slot="template-tile"
      className={cn(
        'flex flex-col items-start gap-2 rounded-lg bg-card p-3.5 text-left text-fg outline-none transition-colors duration-instant ease-standard hover:bg-control-hover focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      <span aria-hidden className="flex text-fg-muted [&_svg:not([class*=size-])]:size-4">
        {icon}
      </span>
      <span className="text-operate font-medium">{name}</span>
      {description ? <span className="text-[12.5px] leading-[1.45] text-pretty text-fg-muted">{description}</span> : null}
    </button>
  );
}

export { TemplateGrid, TemplateItem, TemplateTile, TemplateTiles };
