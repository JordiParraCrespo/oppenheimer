import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * PageHeader — how every routine page opens: a breadcrumb line, then the
 * row with a round glyph, the title (an inline input while editing) and the
 * actions on the right, then a meta line of facts. A `note` band appears
 * only when the state needs explaining (paused), on the card surface with
 * one small action.
 *
 * `size="lg"` is the routine page itself (28px title, 44px glyph); `md` is
 * the editor and every other page (24px, 36px).
 */
function PageHeader({ className, ...props }: React.ComponentProps<'header'>) {
  return (
    <header
      data-slot="page-header"
      className={cn('mb-2 flex flex-col gap-2.5', className)}
      {...props}
    />
  );
}

/** The crumbs: buttons or links for the parents, a muted span for here. */
function PageHeaderCrumbs({ className, children, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="Breadcrumb"
      data-slot="page-header-crumbs"
      className={cn(
        'flex min-h-5 flex-wrap items-center gap-1.5 text-[13px] text-fg-subtle [&_a]:text-fg-muted [&_a:hover]:text-fg [&_button]:text-fg-muted [&_button:hover]:text-fg',
        className,
      )}
      {...props}
    >
      {children}
    </nav>
  );
}

function PageHeaderHere({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="page-header-here"
      className={cn('max-w-[280px] truncate text-fg-subtle', className)}
      {...props}
    />
  );
}

function PageHeaderRow({
  icon,
  title,
  actions,
  size = 'md',
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  icon?: React.ReactNode;
  /** The name, or a `PageHeaderTitleInput` while editing. */
  title: React.ReactNode;
  actions?: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  return (
    <div
      data-slot="page-header-row"
      data-size={size}
      className={cn('flex min-w-0 items-center gap-3', size === 'lg' && 'gap-3.5', className)}
      {...props}
    >
      {icon ? (
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-pill bg-card text-fg',
            size === 'lg' ? 'size-11 [&_svg:not([class*=size-])]:size-[18px]' : 'size-9 [&_svg:not([class*=size-])]:size-4',
          )}
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      {typeof title === 'string' ? (
        <h1
          className={cn(
            'm-0 min-w-0 flex-1 truncate font-semibold text-fg',
            size === 'lg'
              ? 'text-[28px] leading-[1.15] tracking-[-0.019em]'
              : 'text-2xl leading-[1.25] tracking-[-0.018em]',
          )}
        >
          {title}
        </h1>
      ) : (
        title
      )}
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** The title as an input: 21px, borderless, the hover wash, the ring on focus. */
function PageHeaderTitleInput({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type="text"
      data-slot="page-header-title-input"
      className={cn(
        '-ml-2 min-w-0 flex-1 rounded-sm bg-transparent px-2 py-1 text-[21px] font-semibold tracking-[-0.014em] text-fg outline-none transition-[background-color,box-shadow] duration-fast ease-standard placeholder:text-fg-subtle hover:bg-hover-surface focus:bg-card focus:ring-3 focus:ring-ring focus:outline-1 focus:outline-primary',
        className,
      )}
      {...props}
    />
  );
}

/** The facts under the title: status, trigger, agent · model · project, separated by dots. */
function PageHeaderMeta({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="page-header-meta"
      className={cn('flex flex-wrap items-center gap-1.5 text-[13px] text-fg-muted', className)}
      {...props}
    />
  );
}

function PageHeaderSep() {
  return (
    <span aria-hidden className="text-fg-subtle">
      ·
    </span>
  );
}

/** The band under the meta line that explains a state, with one small action on the right. */
function PageHeaderNote({
  action,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { action?: React.ReactNode }) {
  return (
    <div
      data-slot="page-header-note"
      className={cn(
        'mt-1 flex items-center gap-3 rounded-md bg-card py-2.5 pr-2.5 pl-3.5 text-[13px] text-fg-muted motion-safe:animate-label-in',
        className,
      )}
      {...props}
    >
      <span className="min-w-0 flex-1 text-pretty">{children}</span>
      {action}
    </div>
  );
}

export {
  PageHeader,
  PageHeaderCrumbs,
  PageHeaderHere,
  PageHeaderMeta,
  PageHeaderNote,
  PageHeaderRow,
  PageHeaderSep,
  PageHeaderTitleInput,
};
