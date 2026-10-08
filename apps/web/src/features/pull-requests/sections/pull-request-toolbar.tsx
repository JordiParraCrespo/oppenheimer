import {
  Button,
  type DiffLayout,
  DiffStat,
  IconButton,
  SegmentedControl,
  SegmentedControlItem,
} from '@oppenheimer/design-system-web';
import { ChevronLeft, SquareArrowOutUpRight } from '@oppenheimer/design-system-web/icons';
import type { PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { usePullRequest } from '@oppenheimer/frontend-consumer/react';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_PULL_REQUEST_VIEW,
  PULL_REQUEST_VIEWS,
  type PullRequestView,
} from '../lib/pull-request-search';

/**
 * The bar over a pull request, its one header: back to the queue and its
 * three views, GitHub, and Submit review. On Changes the views give way to
 * Back and the diff's layout. Submit review is the screen's, which holds the
 * pending comments it posts; the bar only says where it goes and when.
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
  /** Submit review, drawn while the pull request is open, posting as `viewerLogin`. */
  review: (viewerLogin: string | null) => ReactNode;
}) {
  const { t } = useTranslation();
  const { data: pull } = usePullRequest(address);

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border-subtle bg-card px-3">
      {view === 'changes' ? (
        <>
          <Button variant="ghost" size="sm" onClick={() => onViewChange(DEFAULT_PULL_REQUEST_VIEW)}>
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
      {pull?.isOpen ? review(pull.viewerLogin) : null}
    </div>
  );
}
