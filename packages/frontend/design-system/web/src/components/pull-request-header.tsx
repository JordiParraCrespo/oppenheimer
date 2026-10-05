import { ArrowRightIcon, GitBranchIcon } from 'lucide-react';
import type * as React from 'react';

import { AuthorMark } from '../internal/author-mark';
import { cn } from '../lib/utils';
import { StatusDot, type StatusState } from './status-dot';

/**
 * How a pull request's page opens: a line of pills (its state on
 * `StatusDot` with the caller's word — `active` while open, `completed` once
 * merged —, its lane, `repo #number` in mono), the title at the ladder's H2 in the
 * display face, and who opened it (a session's bot glyph or a person's)
 * with the branch it merges, `head → base` in mono.
 */

function PullRequestHeader({
  state,
  stateLabel,
  lane,
  reference,
  title,
  author,
  authorKind = 'session',
  head,
  base,
  labels = {},
  className,
  ...props
}: Omit<React.ComponentProps<'header'>, 'title'> & {
  state: StatusState;
  /** "Open", the caller's word for `state`. */
  stateLabel: React.ReactNode;
  /** The lane, a `Badge`. */
  lane?: React.ReactNode;
  /** `oppenheimer #482`. */
  reference: React.ReactNode;
  title: React.ReactNode;
  author?: React.ReactNode;
  authorKind?: 'session' | 'person';
  /** The branch it merges, and where to. */
  head?: React.ReactNode;
  base?: React.ReactNode;
  /** `into`: what a screen reader says for the arrow between head and base. */
  labels?: { into?: string };
}) {
  return (
    <header data-slot="pull-request-header" className={cn('flex flex-col gap-2.5 pb-2', className)} {...props}>
      <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
        <StatusDot
          state={state}
          density="compact"
          className="h-6 rounded-pill border border-border-subtle bg-card px-2.5 text-xs font-medium"
        >
          {stateLabel}
        </StatusDot>
        {lane}
        <span className="figures text-xs">{reference}</span>
      </div>
      <h1 className="m-0 font-display text-h2 font-semibold text-pretty text-fg">{title}</h1>
      {author || head ? (
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-fg-muted">
          {author ? (
            <AuthorMark kind={authorKind} className="text-fg">
              {author}
            </AuthorMark>
          ) : null}
          {author && head ? (
            <span aria-hidden className="text-fg-subtle">
              ·
            </span>
          ) : null}
          {head ? (
            <>
              <GitBranchIcon className="size-[13px] text-fg-subtle" aria-hidden />
              <span className="figures text-xs">{head}</span>
              {base ? (
                <>
                  <ArrowRightIcon className="size-3 text-fg-subtle" aria-label={labels.into ?? 'into'} />
                  <span className="figures text-xs">{base}</span>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

export { PullRequestHeader };
