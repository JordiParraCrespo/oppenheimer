'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { FolderIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { Skeleton } from './skeleton';

const FRAME =
  'flex min-w-0 flex-col rounded-lg border border-border-subtle bg-card px-4.5 pt-4.5 pb-5';

/**
 * ProjectCard — one project on Plan's Projects: a folder tile, the name at
 * 17px semibold, its repositories on a mono line under it, and its status
 * (a compact `StatusDot`) at the top right. The whole card is the way into
 * the project, so it renders a button by default and takes `render` for a
 * link. Measured against `design/version1/Tasks.dc.html` (Projects, View).
 */
function ProjectCard({
  name,
  meta,
  status,
  render,
  className,
  ...props
}: useRender.ComponentProps<'button'> &
  Omit<React.ComponentProps<'button'>, 'children'> & {
    name: React.ReactNode;
    /** Mono: the repositories by short name, `xrp-mobile · atlas`. */
    meta?: React.ReactNode;
    /** A compact `StatusDot`: Needs input, Running, Idle. */
    status?: React.ReactNode;
  }) {
  return useRender({
    defaultTagName: 'button',
    render,
    props: mergeProps<'button'>(
      {
        type: 'button',
        className: cn(
          FRAME,
          'w-full text-left text-fg no-underline outline-none transition-colors duration-fast ease-standard hover:bg-card-hover hover:no-underline focus-visible:outline-2 focus-visible:outline-ring',
          className,
        ),
        children: (
          <span data-slot="project-card" className="flex w-full items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-hover-surface text-fg-muted">
              <FolderIcon className="size-3.75" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.75">
              <span className="truncate text-h4 font-semibold">{name}</span>
              {meta ? <span className="truncate font-mono text-xs text-fg-subtle">{meta}</span> : null}
            </span>
            {status ? <span className="shrink-0 text-fg-muted">{status}</span> : null}
          </span>
        ),
      },
      props,
    ),
  });
}

/** The cards at 300px or more each, as many to a row as fit. */
function ProjectCardGrid({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="project-card-grid"
      className={cn('grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3', className)}
      {...props}
    />
  );
}

/** A card while the projects load, in the card's own shape. */
function ProjectCardSkeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="project-card-skeleton" className={cn(FRAME, className)} aria-hidden {...props}>
      <div className="flex items-start gap-3">
        <Skeleton className="size-8 rounded-sm" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </div>
    </div>
  );
}

export { ProjectCard, ProjectCardGrid, ProjectCardSkeleton };
