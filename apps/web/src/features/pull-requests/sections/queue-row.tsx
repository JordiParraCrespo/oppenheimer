import {
  Button,
  IconButton,
  MergeButton,
  PullRequestRow,
  toast,
} from '@oppenheimer/design-system-web';
import { FileText } from '@oppenheimer/design-system-web/icons';
import type { PullRequestEntity } from '@oppenheimer/frontend-consumer';
import { useMergePullRequest } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { notifySuccess } from '@oppenheimer/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LaneBadge } from '../components/lane-badge';
import { CHECK_STATE, formatWait, LATE_SECONDS } from '../lib/view';

/**
 * One row of the queue, with what it does in place: open the briefing or the
 * changes, and merge after one confirm, as the caller. The confirm is this
 * row's own state, so arming one row redraws only it.
 */
export function QueueRow({ pull }: { pull: PullRequestEntity }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const resolveError = useErrorMessage();
  const merge = useMergePullRequest({
    onSuccess: () => notifySuccess('pullRequestMerged', { reference: pull.reference }),
    onError: (error) =>
      toast.error(resolveError(error, t('pullRequests.queue.mergeFailed')).message),
  });
  const params = {
    installationId: pull.installationId,
    githubRepoId: String(pull.githubRepoId),
    number: String(pull.number),
  };
  const open = (view?: 'changes') =>
    navigate({
      to: '/pulls/$installationId/$githubRepoId/$number',
      params,
      search: view ? { view } : {},
    });
  const blocked = pull.blocker ? t(`pullRequests.blocker.${pull.blocker}`) : undefined;

  return (
    <PullRequestRow
      lane={<LaneBadge lane={pull.lane} />}
      title={pull.title}
      reference={pull.reference}
      author={
        pull.authorKind === 'session'
          ? `${t('pullRequests.queue.session')} · ${pull.headRef.replace(/^oppenheimer\//, '')}`
          : pull.author
      }
      authorKind={pull.authorKind}
      note={pull.blocker && pull.blocker !== 'conflicts' ? blocked : undefined}
      noteTone={
        pull.blocker === 'checks_failing' || pull.blocker === 'changes_requested'
          ? 'danger'
          : 'warning'
      }
      additions={pull.additions}
      deletions={pull.deletions}
      checks={CHECK_STATE[pull.checks]}
      checksLabel={t(`pullRequests.checks.${pull.checks}`)}
      conflicts={pull.hasConflicts ? 'blocked' : 'passing'}
      conflictsLabel={t(
        pull.hasConflicts ? 'pullRequests.conflicts.some' : 'pullRequests.conflicts.none',
      )}
      waiting={formatWait(pull.waitingSeconds)}
      waitingTone={pull.waitingSeconds >= LATE_SECONDS ? 'late' : undefined}
      onOpen={() => open()}
      actions={
        <>
          <IconButton
            size="sm"
            aria-label={t('pullRequests.queue.openChanges')}
            onClick={() => open('changes')}
          >
            <FileText />
          </IconButton>
          <Button variant="secondary" size="sm" onClick={() => open()}>
            {t('pullRequests.queue.review')}
          </Button>
          <MergeButton
            merged={merge.isSuccess}
            confirming={confirming}
            onConfirmingChange={setConfirming}
            onMerge={() => {
              setConfirming(false);
              merge.mutate({ address: pull.address });
            }}
            disabledReason={
              blocked ?? (merge.isPending ? t('pullRequests.queue.merged') : undefined)
            }
            labels={{
              merge: t('pullRequests.queue.mergeButton.merge'),
              confirm: t('pullRequests.queue.mergeButton.confirm'),
              cancel: t('pullRequests.queue.mergeButton.cancel'),
              merged: t('pullRequests.queue.merged'),
            }}
          />
        </>
      }
    />
  );
}
