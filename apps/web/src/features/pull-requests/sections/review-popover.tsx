import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  ReviewDecision,
  SubmitReviewButton,
  toast,
} from '@oppenheimer/design-system-web';
import type {
  LineCommentInput,
  PullRequestAddress,
  ReviewVerdict,
} from '@oppenheimer/frontend-consumer';
import { useSubmitPullRequestReview } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { notifySuccess } from '@oppenheimer/frontend-web';
import { REVIEW_VERDICTS } from '@oppenheimer/shared/schemas/pull-request';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Submit review: the verdict, a comment, and the pending line comments, posted
 * together as the caller. Approving merges when GitHub allows it; when it
 * does not, the pull request waits and the toast says so.
 */
export function ReviewPopover({
  address,
  viewerLogin,
  pending,
  onSubmitted,
  onDiscard,
}: {
  address: PullRequestAddress;
  viewerLogin: string | null;
  pending: readonly LineCommentInput[];
  onSubmitted: () => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [verdict, setVerdict] = useState<ReviewVerdict>('approve');
  const [comment, setComment] = useState('');
  const submit = useSubmitPullRequestReview({
    onSuccess: ({ merged }) => {
      setOpen(false);
      setComment('');
      onSubmitted();
      notifySuccess(
        verdict !== 'approve'
          ? 'reviewSubmitted'
          : merged
            ? 'reviewApprovedMerged'
            : 'reviewApprovedWaiting',
      );
    },
    onError: (error) => toast.error(resolveError(error, t('pullRequests.review.failed')).message),
  });
  const needsWords = verdict !== 'approve' && !comment.trim() && pending.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<SubmitReviewButton count={pending.length || undefined} />}>
        {t('pullRequests.review.submit')}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-95">
        <ReviewDecision
          verdicts={REVIEW_VERDICTS.map((value) => ({
            value,
            label: t(`pullRequests.review.verdicts.${value}.label`),
            description: t(`pullRequests.review.verdicts.${value}.description`),
          }))}
          verdict={verdict}
          onVerdictChange={(value) => setVerdict(value as ReviewVerdict)}
          comment={comment}
          onCommentChange={setComment}
          note={[
            pending.length ? t('pullRequests.review.pending', { count: pending.length }) : null,
            viewerLogin ? t('pullRequests.review.postsAs', { login: viewerLogin }) : null,
          ]
            .filter(Boolean)
            .join(' ')}
          submitLabel={t(`pullRequests.review.verdicts.${verdict}.label`)}
          submitDisabled={needsWords || submit.isPending}
          onSubmit={() =>
            submit.mutate({
              address,
              review: { verdict, body: comment.trim() || undefined, comments: [...pending] },
            })
          }
          onDiscard={() => {
            setComment('');
            onDiscard();
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          labels={{
            title: t('pullRequests.review.title'),
            comment: t('pullRequests.review.comment'),
            optional: t('pullRequests.review.optional'),
            placeholder: t('pullRequests.review.placeholder'),
            discard: t('pullRequests.review.discard'),
            close: t('pullRequests.review.close'),
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
