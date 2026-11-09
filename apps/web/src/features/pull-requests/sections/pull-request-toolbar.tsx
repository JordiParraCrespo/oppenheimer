import {
  type DiffLayout,
  DiffStat,
  IconButton,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
  SubmitReviewButton,
} from '@oppenheimer/design-system-web';
import { ChevronLeft, SquareArrowOutUpRight } from '@oppenheimer/design-system-web/icons';
import type { PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { usePullRequest } from '@oppenheimer/frontend-consumer/react';
import { SidebarToggle } from '@oppenheimer/frontend-web';
import { Link, useLocation } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PULL_REQUEST_VIEWS,
  type PullRequestView,
  pullsReturnLink,
} from '../lib/pull-request-search';

/**
 * The bar over a pull request, its one header and the page's bar (the
 * route's `bar: 'own'`): the sidebar toggle, back to the queue (or to the review deck's card it
 * was opened from) and its three views, GitHub,
 * and Submit review. The views stay the same on every view; Changes adds
 * the diff's layout beside them. Submit review is the screen's, which holds the
 * pending comments it posts; the bar only places it while the pull is open.
 * While the pull is read, the diff stat is a bar at its width and GitHub and
 * Submit review hold their places, disabled, so the bar does not widen.
 */
export function PullRequestToolbar({
  address,
  view,
  onViewChange,
  layout,
  onLayoutChange,
  review,
}: {
  address: PullRequestAddress;
  view: PullRequestView;
  onViewChange: (view: PullRequestView) => void;
  layout: DiffLayout;
  onLayoutChange: (layout: DiffLayout) => void;
  /** Submit review, placed while the pull request is open. */
  review: ReactNode;
}) {
  const { t } = useTranslation();
  const { data: pull, isPending } = usePullRequest(address);
  const back = pullsReturnLink(useLocation({ select: (location) => location.state.pullsReturn }));

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border-subtle bg-card px-3">
      <SidebarToggle />
      <IconButton
        size="sm"
        aria-label={t(back.label)}
        render={<Link to={back.to} search={back.search} />}
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
            ) : value === 'changes' && isPending ? (
              <span aria-hidden className="inline-flex h-4 items-center">
                <Skeleton shape="sm" className="h-2.5 w-12" />
              </span>
            ) : null}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      {view === 'changes' ? (
        <SegmentedControl
          size="md"
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
      ) : null}
      <span className="flex-1" />
      {pull ? (
        <IconButton
          aria-label={t('pullRequests.detail.openOnGithub')}
          render={<a href={pull.htmlUrl} target="_blank" rel="noreferrer" />}
        >
          <SquareArrowOutUpRight />
        </IconButton>
      ) : isPending ? (
        <IconButton aria-label={t('pullRequests.detail.openOnGithub')} disabled>
          <SquareArrowOutUpRight />
        </IconButton>
      ) : null}
      {pull?.isOpen ? (
        review
      ) : isPending ? (
        <SubmitReviewButton disabled>{t('pullRequests.review.submit')}</SubmitReviewButton>
      ) : null}
    </div>
  );
}
