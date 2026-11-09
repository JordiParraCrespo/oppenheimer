import { DiffStat, PullRequestHeader, StatusDot } from '@oppenheimer/design-system-web';
import type { PullRequestEntity } from '@oppenheimer/frontend-consumer';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { LaneBadge } from '../components/lane-badge';
import { ReviewBriefSkeleton } from '../components/review-brief-skeleton';
import { CHECK_STATE, formatWait } from '../lib/view';
import { ReviewBrief } from './review-brief';

/**
 * One pull request as a card of the review deck: who opened it and what it
 * is called, drawn at once from the queue's row; its brief, which is a read
 * of its own and may still be being written; and the facts that decide what
 * can be done with it — checks, conflicts, size, the wait and what holds it.
 */
export function ReviewCard({ pull }: { pull: PullRequestEntity }) {
  const { t } = useTranslation();
  return (
    <article className="flex flex-col gap-6 rounded-xl bg-card p-6 shadow-sm sm:p-8">
      <PullRequestHeader
        state={pull.draft ? 'idle' : 'active'}
        stateLabel={t(`pullRequests.detail.state.${pull.draft ? 'draft' : 'open'}`)}
        lane={<LaneBadge lane={pull.lane} />}
        reference={pull.reference}
        title={pull.title}
        author={
          pull.authorKind === 'session'
            ? `${t('pullRequests.queue.session')} · ${pull.headRef.replace(/^oppenheimer\//, '')}`
            : pull.author
        }
        authorKind={pull.authorKind}
        className="pb-0"
      />
      <QueryState>
        <QueryState.Pending>
          <ReviewBriefSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('pullRequests.deck.briefFailed')} />
        <QueryState.Data>
          <ReviewBrief address={pull.address} />
        </QueryState.Data>
      </QueryState>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border-subtle pt-5 text-sm text-fg-muted">
        <StatusDot state={CHECK_STATE[pull.checks]} density="compact">
          {t(`pullRequests.checks.${pull.checks}`)}
        </StatusDot>
        <StatusDot state={pull.hasConflicts ? 'blocked' : 'passing'} density="compact">
          {t(pull.hasConflicts ? 'pullRequests.conflicts.some' : 'pullRequests.conflicts.none')}
        </StatusDot>
        <DiffStat additions={pull.additions} deletions={pull.deletions} />
        <span>
          {t('pullRequests.deck.waiting')}{' '}
          <span className="figures text-fg">{formatWait(pull.waitingSeconds)}</span>
        </span>
      </div>
    </article>
  );
}
