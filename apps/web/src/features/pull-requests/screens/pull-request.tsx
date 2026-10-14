import { type DiffLayout, Skeleton } from '@oppenheimer/design-system-web';
import type { LineCommentInput, PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { PaneBar, QueryState } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type PullRequestView, pullRequestSearch } from '../lib/pull-request-search';
import { PullRequestChanges } from '../sections/pull-request-changes';
import { PullRequestDescription } from '../sections/pull-request-description';
import { PullRequestToolbar } from '../sections/pull-request-toolbar';
import { ReviewPopover } from '../sections/review-popover';

/**
 * A pull request: the bar and one of its two views, Description and Changes. The review's pending
 * line comments are shared by two of them — written on Changes, posted from
 * Submit review — and the diff's layout is switched in the bar and drawn on
 * Changes, so both live here.
 *
 * The bar sits in the shell's slot above the page (`PaneBar`), so it stays put
 * while the view scrolls under it; each view is a page the shell frames at
 * the measure the route reads off `?view=`. Each view reads under Suspense,
 * so its placeholder and a first failure are drawn here, around it.
 */
export function PullRequestScreen({
  address,
  view,
}: {
  address: PullRequestAddress;
  view: PullRequestView;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pending, setPending] = useState<LineCommentInput[]>([]);
  const [layout, setLayout] = useState<DiffLayout>('unified');
  // A view is the same page read another way: it keeps the queue the pull
  // request was opened from, so Back still returns to it.
  const setView = (next: PullRequestView) =>
    navigate({ to: '.', search: pullRequestSearch(next), state: (previous) => previous });

  return (
    <>
      <PaneBar>
        <PullRequestToolbar
          address={address}
          view={view}
          onViewChange={setView}
          layout={layout}
          onLayoutChange={setLayout}
          review={
            <ReviewPopover
              address={address}
              pending={pending}
              onSubmitted={() => setPending([])}
              onDiscard={() => setPending([])}
            />
          }
        />
      </PaneBar>
      {
        {
          description: (
            <QueryState>
              <QueryState.Pending>
                <Skeleton className="h-96 w-full" />
              </QueryState.Pending>
              <QueryState.Error fallback={t('pullRequests.detail.loadFailed')} />
              <QueryState.Data>
                <PullRequestDescription address={address} />
              </QueryState.Data>
            </QueryState>
          ),
          changes: (
            <QueryState>
              <QueryState.Pending>
                <Skeleton className="min-h-0 w-full flex-1" />
              </QueryState.Pending>
              <QueryState.Error fallback={t('pullRequests.changes.loadFailed')} />
              <QueryState.Data>
                <PullRequestChanges
                  address={address}
                  layout={layout}
                  pending={pending}
                  onAddPending={(comment) => setPending((current) => [...current, comment])}
                  onDiscardPending={(index) =>
                    setPending((current) => current.filter((_, i) => i !== index))
                  }
                />
              </QueryState.Data>
            </QueryState>
          ),
        }[view]
      }
    </>
  );
}
