import { CircleAlert, CircleCheck, CircleDashed } from '@oppenheimer/design-system-web/icons';
import type { PullRequestDetailEntity } from '@oppenheimer/frontend-consumer';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ReviewerRow } from './reviewer-row';

function railSection(label: string, children?: ReactNode, aside?: ReactNode) {
  return (
    <section
      key={label}
      className="flex flex-col gap-3 border-b border-border-subtle py-4 first:pt-0 last:border-b-0"
    >
      <div className="flex items-center justify-between gap-3 text-sm text-fg-muted">
        <h2 className="m-0 text-sm font-normal text-fg-muted">{label}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * Beside a description, what decides whether it can go in: whether it merges
 * cleanly, who is reviewing it and what its checks say, each a quiet section
 * under a muted label, the way the Codex app's pull request page reads.
 */
export function PullRequestRail({ pull }: { pull: PullRequestDetailEntity }) {
  const { t } = useTranslation();
  const base = pull.baseRef;
  const merge =
    pull.state === 'merged'
      ? {
          icon: <CircleCheck className="size-4 text-success" aria-hidden />,
          text: t('pullRequests.detail.rail.merged', { base }),
        }
      : pull.state === 'closed'
        ? {
            icon: <CircleDashed className="size-4 text-fg-subtle" aria-hidden />,
            text: t('pullRequests.detail.rail.closed'),
          }
        : pull.hasConflicts
          ? {
              icon: <CircleAlert className="size-4 text-danger" aria-hidden />,
              text: t('pullRequests.detail.rail.conflicts', { base }),
            }
          : {
              icon: <CircleCheck className="size-4 text-success" aria-hidden />,
              text: t('pullRequests.detail.rail.canMerge'),
            };
  const { total, passed } = pull.checkCounts;
  return (
    <aside className="flex flex-col lg:w-72 lg:shrink-0">
      {railSection(
        t('pullRequests.detail.rail.mergeStatus'),
        <p className="m-0 flex items-center gap-2.5 text-operate text-fg">
          {merge.icon}
          {merge.text}
        </p>,
      )}
      {railSection(
        t('pullRequests.detail.rail.reviews'),
        <div className="flex flex-col gap-3">
          {pull.unread.includes('reviews') ? (
            <p className="m-0 text-sm text-fg-muted">{t('pullRequests.detail.reviewsUnread')}</p>
          ) : pull.reviewers.length ? (
            pull.reviewers.map((reviewer) => (
              <ReviewerRow key={reviewer.login} reviewer={reviewer} />
            ))
          ) : (
            <p className="m-0 text-sm text-fg-muted">{t('pullRequests.detail.noReviewers')}</p>
          )}
        </div>,
      )}
      {railSection(
        t('pullRequests.detail.checks'),
        null,
        <span className="text-sm">
          {total
            ? t('pullRequests.detail.rail.checksSummary', { passed, total })
            : pull.checks === 'unavailable'
              ? t('pullRequests.checks.unavailable')
              : t('pullRequests.detail.rail.noChecks')}
        </span>,
      )}
    </aside>
  );
}
