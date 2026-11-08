'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { Card } from './card';
import { MilestoneGlyph } from './milestone-timeline';
import { Skeleton } from './skeleton';
import { dotVariants, type StatusState } from './status-dot';

/**
 * ProjectOverview — a project's page on Plan, as the Projects view draws it
 * once a card is opened (`design/version1/Tasks.dc.html`): two columns of
 * panels at 320px or more each, Milestones on the left, Needs input and In
 * progress stacked on the right. Each panel is a `Card` headed by an
 * uppercase eyebrow, its rows under it, and a muted line when it has none.
 */
function ProjectOverview({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="project-overview"
      className={cn(
        'grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-start gap-3',
        className,
      )}
      {...props}
    />
  );
}

/** A column of panels in the overview. */
function ProjectOverviewColumn({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="project-overview-column" className={cn('flex min-w-0 flex-col gap-3', className)} {...props} />
  );
}

/** One panel: the eyebrow, then its rows. */
function ProjectPanel({
  label,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Card>, 'title'> & { label: React.ReactNode }) {
  return (
    <Card data-slot="project-panel" className={cn('gap-3 p-4.5', className)} {...props}>
      <h2 className="m-0 text-micro font-medium tracking-wide text-fg-subtle uppercase">{label}</h2>
      <div className="flex flex-col gap-1">{children}</div>
    </Card>
  );
}

/** What a panel says when it has no rows: "No milestones yet." */
function ProjectPanelEmpty({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="project-panel-empty" className={cn('m-0 text-sm text-fg-muted', className)} {...props} />;
}

/**
 * A milestone in the Milestones panel: the diamond (filled once every task is
 * done), the name, "done / total" in mono, and under them a 4px bar with the
 * percentage. A link to the milestone through `render`.
 */
function ProjectMilestoneRow({
  name,
  done,
  total,
  render,
  className,
  ...props
}: useRender.ComponentProps<'div'> &
  Omit<React.ComponentProps<'div'>, 'children'> & {
    name: React.ReactNode;
    done: number;
    total: number;
  }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;
  return useRender({
    defaultTagName: 'div',
    render,
    props: mergeProps<'div'>(
      {
        className: cn(
          '-mx-2 flex flex-col gap-2 rounded-sm px-2 py-2 text-fg no-underline outline-none transition-colors duration-fast ease-standard hover:no-underline focus-visible:outline-2 focus-visible:outline-ring [a&]:hover:bg-hover-surface',
          className,
        ),
        children: (
          <>
            <span className="flex items-center gap-2.5">
              <MilestoneGlyph filled={complete} className="text-fg-muted" />
              <span className="min-w-0 flex-1 truncate text-operate">{name}</span>
              <span className="figures shrink-0 font-mono text-micro text-fg-subtle">
                {done} / {total}
              </span>
            </span>
            <span className="flex items-center gap-2.5 pl-5">
              <span
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                className="h-1 flex-1 overflow-hidden rounded-pill bg-hover-surface"
              >
                <span
                  className={cn('block h-full rounded-pill', complete ? 'bg-success' : 'bg-fg-muted')}
                  // biome-ignore lint/style/noInlineStyles: the share done is data.
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="figures w-9 shrink-0 text-right font-mono text-micro text-fg-subtle">{pct}%</span>
            </span>
          </>
        ),
      },
      props,
    ),
  });
}

/**
 * A task in a panel: a run-state dot, the title, and its due date in mono at
 * the right. `reason` puts why it waits on a person above the title (Needs
 * input). A link to the task through `render`.
 */
function ProjectTaskRow({
  title,
  state,
  due,
  reason,
  render,
  className,
  ...props
}: useRender.ComponentProps<'div'> &
  Omit<React.ComponentProps<'div'>, 'children' | 'title'> & {
    title: React.ReactNode;
    state: StatusState;
    due?: React.ReactNode;
    reason?: React.ReactNode;
  }) {
  const dot = <span className={dotVariants({ state })} aria-hidden />;
  return useRender({
    defaultTagName: 'div',
    render,
    props: mergeProps<'div'>(
      {
        className: cn(
          '-mx-2 flex min-h-8 flex-col justify-center gap-1 rounded-sm px-2 py-1.5 text-fg no-underline outline-none transition-colors duration-fast ease-standard hover:no-underline focus-visible:outline-2 focus-visible:outline-ring [a&]:hover:bg-hover-surface',
          className,
        ),
        children: reason ? (
          <>
            <span className="flex items-start gap-1.5 text-sm text-fg-muted">
              <span className="flex h-[1.4em] shrink-0 items-center">{dot}</span>
              {reason}
            </span>
            <span className="flex items-baseline gap-2.5">
              <span className="min-w-0 flex-1 text-operate text-pretty">{title}</span>
              {due ? <span className="figures shrink-0 font-mono text-micro text-fg-subtle">{due}</span> : null}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-2.5">
            {dot}
            <span className="min-w-0 flex-1 text-operate text-pretty">{title}</span>
            {due ? <span className="figures shrink-0 font-mono text-micro text-fg-subtle">{due}</span> : null}
          </span>
        ),
      },
      props,
    ),
  });
}

/** The overview while it loads: the panels with their eyebrows, rows as bars. */
function ProjectOverviewSkeleton({ labels }: { labels: [React.ReactNode, React.ReactNode] }) {
  return (
    <ProjectOverview aria-hidden>
      {labels.map((label, column) => (
        <ProjectOverviewColumn key={column}>
          <ProjectPanel label={label}>
            {[0, 1].map((row) => (
              <div key={row} className="flex h-8 items-center gap-2.5">
                <Skeleton className="size-2" />
                <Skeleton className={cn('h-3.5', row ? 'w-2/5' : 'w-3/5')} />
              </div>
            ))}
          </ProjectPanel>
        </ProjectOverviewColumn>
      ))}
    </ProjectOverview>
  );
}

export {
  ProjectMilestoneRow,
  ProjectOverview,
  ProjectOverviewColumn,
  ProjectOverviewSkeleton,
  ProjectPanel,
  ProjectPanelEmpty,
  ProjectTaskRow,
};
