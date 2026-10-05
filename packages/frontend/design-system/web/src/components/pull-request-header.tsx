import { ArrowRightIcon, BotIcon, GitBranchIcon, UserIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { dotVariants, type StatusState } from './status-dot';

/**
 * How a pull request's page opens: a line of pills (its state with a dot,
 * its lane, `repo #number` in mono), the title at the ladder's H2 in the
 * display face, and who opened it (a session's bot glyph or a person's)
 * with the branch it merges, `head → base` in mono.
 */

type PullRequestState = 'open' | 'draft' | 'merged' | 'closed';

const STATE_DOT: Record<PullRequestState, StatusState> = {
  open: 'running',
  draft: 'idle',
  merged: 'queued',
  closed: 'failed',
};

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
  className,
  ...props
}: Omit<React.ComponentProps<'header'>, 'title'> & {
  state: PullRequestState;
  /** "Open", the caller's word for `state`. */
  stateLabel: React.ReactNode;
  /** A `LaneBadge`. */
  lane?: React.ReactNode;
  /** `oppenheimer #482`. */
  reference: React.ReactNode;
  title: React.ReactNode;
  author?: React.ReactNode;
  authorKind?: 'session' | 'person';
  /** The branch it merges, and where to. */
  head?: React.ReactNode;
  base?: React.ReactNode;
}) {
  return (
    <header data-slot="pull-request-header" className={cn('flex flex-col gap-2.5 pb-2', className)} {...props}>
      <div className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-pill border border-border-subtle bg-card px-2.5 text-xs font-medium text-fg">
          <span aria-hidden className={cn(dotVariants({ state: STATE_DOT[state] }), 'size-[7px]')} />
          {stateLabel}
        </span>
        {lane}
        <span className="figures text-xs">{reference}</span>
      </div>
      <h1 className="m-0 font-display text-h2 font-semibold text-pretty text-fg">{title}</h1>
      {author || head ? (
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-fg-muted">
          {author ? (
            <>
              {authorKind === 'session' ? (
                <BotIcon className="size-[13px] text-fg-subtle" aria-hidden />
              ) : (
                <UserIcon className="size-[13px] text-fg-subtle" aria-hidden />
              )}
              <span className="text-fg">{author}</span>
            </>
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
                  <ArrowRightIcon className="size-3 text-fg-subtle" aria-label="into" />
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
export type { PullRequestState };
