import {
  Button,
  type DiffLayout,
  DiffStat,
  IconButton,
  SegmentedControl,
  SegmentedControlItem,
} from '@oppenheimer/design-system-web';
import { ChevronLeft, SquareArrowOutUpRight } from '@oppenheimer/design-system-web/icons';
import type { LineCommentInput, PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { usePullRequest } from '@oppenheimer/frontend-consumer/react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PULL_REQUEST_VIEWS, type PullRequestView } from '../lib/pull-request-search';
import { ReviewPopover } from './review-popover';

/**
 * The bar over a pull request, its one header: back to the queue and its
 * three views, GitHub, and Submit review. On Changes the views give way to
 * Back, to the description, and the diff's layout.
 */
export function PullRequestToolbar({
  address,
  view,
  onViewChange,
  layout,
  onLayoutChange,
  pending,
  onReviewSubmitted,
  onDiscardPending,
}: {
  address: PullRequestAddress;
  view: PullRequestView;
  onViewChange: (view: PullRequestView) => void;
  layout: DiffLayout;
  onLayoutChange: (layout: DiffLayout) => void;
  pending: readonly LineCommentInput[];
  onReviewSubmitted: () => void;
  onDiscardPending: () => void;
}) {
  const { t } = useTranslation();
  const { data: pull } = usePullRequest(address);

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border-subtle bg-card px-3">
      {view === 'changes' ? (
        <>
          <Button variant="ghost" size="sm" onClick={() => onViewChange('description')}>
            <ChevronLeft />
            {t('pullRequests.changes.back')}
          </Button>
          <SegmentedControl
            value={layout}
            onValueChange={(next) => onLayoutChange(next as DiffLayout)}
            aria-label={t('pullRequests.changes.layout')}
          >
            <SegmentedControlItem value="unified">
              {t('pullRequests.changes.unified')}
            </SegmentedControlItem>
            <SegmentedControlItem value="split">
              {t('pullRequests.changes.split')}
            </SegmentedControlItem>
          </SegmentedControl>
        </>
      ) : (
        <>
          <IconButton
            size="sm"
            aria-label={t('pullRequests.detail.back')}
            render={<Link to="/pulls" />}
          >
            <ChevronLeft />
          </IconButton>
          <SegmentedControl
            size="md"
            value={view}
            onValueChange={(next) => onViewChange(next as PullRequestView)}
            aria-label={t('pullRequests.detail.viewLabel')}
          >
            {PULL_REQUEST_VIEWS.map((value) => (
              <SegmentedControlItem key={value} value={value}>
                {t(`pullRequests.detail.views.${value}`)}
                {value === 'changes' && pull ? (
                  <DiffStat additions={pull.additions} deletions={pull.deletions} />
                ) : null}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </>
      )}
      <span className="flex-1" />
      {pull ? (
        <IconButton
          aria-label={t('pullRequests.detail.openOnGithub')}
          render={<a href={pull.htmlUrl} target="_blank" rel="noreferrer" />}
        >
          <SquareArrowOutUpRight />
        </IconButton>
      ) : null}
      {pull?.isOpen ? (
        <ReviewPopover
          address={address}
          viewerLogin={pull.viewerLogin}
          pending={pending}
          onSubmitted={onReviewSubmitted}
          onDiscard={onDiscardPending}
        />
      ) : null}
    </div>
  );
}
