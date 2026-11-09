import { Button, Kbd, Textarea, toast } from '@oppenheimer/design-system-web';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  GitMerge,
  MessageSquare,
} from '@oppenheimer/design-system-web/icons';
import type { PullRequestEntity, ReviewVerdict } from '@oppenheimer/frontend-consumer';
import {
  useMergePullRequest,
  useSubmitPullRequestReview,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { notifySuccess } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReviewDeckKeys } from '../hooks/use-review-deck-keys';

/**
 * What can be done with the card on screen, each with its key, and then the
 * deck moves on (`onActed`): the reader never goes back to a list between two
 * pull requests.
 *
 * Yours and your sessions' are merged; anybody else's is approved, or
 * approved and merged. A merge is armed by its first press and made by the
 * second, since one key must not be all that stands before a merge. A comment
 * is a review of its own: Request changes on somebody else's, Comment on
 * yours, where GitHub takes no verdict. The bar floats at the foot of the pane,
 * so a long card never hides it. The mutations and what is armed are
 * this section's, which the deck keys per card, so nothing carries over.
 */
export function ReviewActions({
  pull,
  onActed,
  onPass,
  onOpen,
}: {
  pull: PullRequestEntity;
  onActed: () => void;
  onPass: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const [armed, setArmed] = useState(false);
  const [composing, setComposing] = useState(false);
  const [comment, setComment] = useState('');
  const mine = pull.scope === 'mine';
  const blocked = pull.blocker ? t(`pullRequests.blocker.${pull.blocker}`) : undefined;

  const merge = useMergePullRequest({
    onSuccess: () => {
      notifySuccess('pullRequestMerged', { reference: pull.reference });
      onActed();
    },
    onError: (error) =>
      toast.error(resolveError(error, t('pullRequests.queue.mergeFailed')).message),
  });
  const review = useSubmitPullRequestReview({
    onSuccess: ({ merged, autoMerge }, { review: sent }) => {
      notifySuccess(
        sent.verdict === 'approve'
          ? 'reviewApproved'
          : sent.verdict !== 'approve_and_merge'
            ? 'reviewSubmitted'
            : merged
              ? 'reviewApprovedMerged'
              : autoMerge
                ? 'reviewApprovedAutoMerge'
                : 'reviewApprovedWaiting',
      );
      onActed();
    },
    onError: (error) => toast.error(resolveError(error, t('pullRequests.review.failed')).message),
  });
  const busy = merge.isPending || review.isPending;
  const submit = (verdict: ReviewVerdict, body?: string) =>
    review.mutate({ address: pull.address, review: { verdict, body, comments: [] } });

  // The merging press: yours merges, somebody else's is approved and merged.
  const canMerge = mine ? !blocked : true;
  const mergeNow = () => {
    if (busy || !canMerge) return;
    if (!armed) return setArmed(true);
    setArmed(false);
    if (mine) merge.mutate({ address: pull.address });
    else submit('approve_and_merge');
  };
  const approve = () => {
    if (!busy) submit('approve');
  };
  const send = () => {
    if (busy || !comment.trim()) return;
    submit(mine ? 'comment' : 'request_changes', comment.trim());
  };

  useReviewDeckKeys({
    onYes: mine ? mergeNow : approve,
    onPass: busy ? undefined : onPass,
    onOpen,
    onComment: () => setComposing(true),
    onMerge: mergeNow,
    onRelease: () => {
      setArmed(false);
      setComposing(false);
    },
  });

  const commentLabel = t(mine ? 'pullRequests.deck.comment' : 'pullRequests.deck.requestChanges');
  return (
    <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-border-subtle bg-card p-3 shadow-lg">
      {composing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            autoFocus
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send();
              if (event.key === 'Escape') setComposing(false);
            }}
            aria-label={commentLabel}
            placeholder={t(
              mine
                ? 'pullRequests.deck.commentPlaceholder'
                : 'pullRequests.deck.requestChangesPlaceholder',
            )}
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>
              {t('pullRequests.changes.cancel')}
            </Button>
            <Button size="sm" onClick={send} disabled={!comment.trim()} pending={review.isPending}>
              {commentLabel}
              <Kbd className="ml-1">⌘⏎</Kbd>
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={onPass} disabled={busy}>
          <ArrowLeft />
          {t('pullRequests.deck.pass')}
          <Kbd className="ml-1">←</Kbd>
        </Button>
        <span className="flex-1" />
        <Button variant="ghost" onClick={() => setComposing(true)} disabled={busy}>
          <MessageSquare />
          {commentLabel}
          <Kbd className="ml-1">C</Kbd>
        </Button>
        <Button variant="ghost" onClick={onOpen}>
          <Eye />
          {t('pullRequests.deck.open')}
          <Kbd className="ml-1">⏎</Kbd>
        </Button>
        {mine ? null : (
          <Button
            variant="secondary"
            onClick={mergeNow}
            disabled={busy && !armed}
            pending={review.isPending && review.variables?.review.verdict === 'approve_and_merge'}
          >
            <GitMerge />
            {t(armed ? 'pullRequests.deck.confirmMerge' : 'pullRequests.deck.approveAndMerge')}
            <Kbd className="ml-1">M</Kbd>
          </Button>
        )}
        {mine ? (
          <Button
            onClick={mergeNow}
            disabled={!canMerge || (busy && !armed)}
            pending={merge.isPending}
            title={blocked}
          >
            <GitMerge />
            {t(armed ? 'pullRequests.deck.confirmMerge' : 'pullRequests.queue.mergeButton.merge')}
            <Kbd className="ml-1">→</Kbd>
          </Button>
        ) : (
          <Button
            onClick={approve}
            disabled={busy}
            pending={review.isPending && review.variables?.review.verdict === 'approve'}
          >
            {t('pullRequests.deck.approve')}
            <ArrowRight />
            <Kbd className="ml-1">→</Kbd>
          </Button>
        )}
      </div>
      {blocked ? (
        <p className="m-0 px-1 text-right text-sm text-fg-muted">
          {t('pullRequests.deck.held', { reason: blocked })}
        </p>
      ) : null}
    </div>
  );
}
