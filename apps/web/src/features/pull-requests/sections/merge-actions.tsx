import { Button, MergeButton, toast } from '@oppenheimer/design-system-web';
import { Eye } from '@oppenheimer/design-system-web/icons';
import type { PullRequestDetailEntity } from '@oppenheimer/frontend-consumer';
import { useMergePullRequest } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { notifySuccess } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** The path to merge's two actions: read the changes, or merge as the caller after one confirm. */
export function MergeActions({
  pull,
  onReviewChanges,
}: {
  pull: PullRequestDetailEntity;
  onReviewChanges: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const [confirming, setConfirming] = useState(false);
  const merge = useMergePullRequest({
    onSuccess: () => notifySuccess('pullRequestMerged', { reference: pull.reference }),
    onError: (error) =>
      toast.error(resolveError(error, t('pullRequests.queue.mergeFailed')).message),
  });

  return (
    <>
      <Button variant="secondary" onClick={onReviewChanges}>
        <Eye />
        {t('pullRequests.detail.reviewChanges')}
      </Button>
      <MergeButton
        merged={pull.state === 'merged' || merge.isSuccess}
        confirming={confirming}
        onConfirmingChange={setConfirming}
        onMerge={() => {
          setConfirming(false);
          merge.mutate({ address: pull.address });
        }}
        disabledReason={pull.blocker ? t(`pullRequests.blocker.${pull.blocker}`) : undefined}
        labels={{
          merge: t('pullRequests.queue.mergeButton.merge'),
          confirm: t('pullRequests.queue.mergeButton.confirm'),
          cancel: t('pullRequests.queue.mergeButton.cancel'),
          merged: t('pullRequests.queue.merged'),
        }}
      />
    </>
  );
}
