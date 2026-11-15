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
 * When a card's checkbox shows: on hover, on focus within, or while the grid
 * is selecting. Hidden, it takes no press, so a tap on a phone (no hover)
 * opens the project rather than checking it.
 */
const SELECT_SHOWN =
  'pointer-events-none opacity-0 group-hover/project:pointer-events-auto group-hover/project:opacity-100 group-focus-within/project:opacity-100 group-data-selecting/project:pointer-events-auto group-data-selecting/project:opacity-100';
/** The folder tile gives way to the checkbox wherever it shows. */
const SELECT_TAKES_TILE =
  'group-hover/project:invisible group-focus-within/project:invisible group-data-selecting/project:invisible';

/**
 * ProjectCard — one project on Plan's Projects: a folder tile, the name at
 * 17px semibold, its repositories on a mono line under it, and its status
 * (a compact `StatusDot`) at the top right. The whole card is the way into
 * the project, so it renders a button by default and takes `render` for a
 * link. Measured against `design/version1/Tasks.dc.html` (Projects, View).
 *
 * `select` is its checkbox (a `Checkbox`), beside the card rather than in it
 * so a control never nests in the link: it takes the folder tile's place on
 * hover or focus, and on every card while the grid is `selecting`. A
 * `selected` card takes the selected wash and the primary border.
 */
function ProjectCard({
  name,
  meta,
  status,
  select,
  selected,
  selecting,
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
    /** The card's checkbox, a small `Checkbox`, over the folder tile. */
    select?: React.ReactNode;
    selected?: boolean;
    /** Something in the grid is selected: every card shows its checkbox. */
    selecting?: boolean;
  }) {
  const card = useRender({
    defaultTagName: 'button',
    render,
    props: mergeProps<'button'>(
      {
        type: 'button',
        className: cn(
          FRAME,
          'w-full text-left text-fg no-underline outline-none transition-colors duration-fast ease-standard hover:bg-card-hover hover:no-underline focus-visible:outline-2 focus-visible:outline-ring',
          selected && 'border-primary bg-selected-surface hover:bg-selected-surface',
          className,
        ),
        children: (
          <span data-slot="project-card" className="flex w-full items-start gap-3">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-sm bg-hover-surface text-fg-muted',
                select !== undefined && SELECT_TAKES_TILE,
              )}
            >
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

  if (select === undefined) return card;
  return (
    <div
      data-slot="project-card-row"
      data-selecting={selecting || undefined}
      className="group/project relative min-w-0"
    >
      {card}
      <span
        className={cn(
          'absolute top-4.5 left-4.5 flex size-8 items-center justify-center transition-opacity duration-fast',
          SELECT_SHOWN,
        )}
      >
        {select}
      </span>
    </div>
  );
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
