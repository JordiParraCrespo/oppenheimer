import {
  FactGrid,
  FactTile,
  MergePath,
  Panel,
  PanelGrid,
  PullRequestHeader,
  Skeleton,
  StatBar,
  StatCard,
  type StatusState,
} from '@oppenheimer/design-system-web';
import { CircleAlert, CircleCheck } from '@oppenheimer/design-system-web/icons';
import type { PullRequestAddress, PullRequestDetailEntity } from '@oppenheimer/frontend-consumer';
import { usePullRequest } from '@oppenheimer/frontend-consumer/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { LaneBadge } from '../components/lane-badge';
import { ReviewerRow } from '../components/reviewer-row';
import { laneReasonText, mergeSteps } from '../lib/briefing';
import { leadOf } from '../lib/markdown';
import { folderList } from '../lib/view';
import { MergeActions } from './merge-actions';

function stateOf(pull: PullRequestDetailEntity): {
  state: StatusState;
  key: 'open' | 'merged' | 'closed' | 'draft';
} {
  if (pull.state === 'merged') return { state: 'completed', key: 'merged' };
  if (pull.state === 'closed') return { state: 'idle', key: 'closed' };
  if (pull.draft) return { state: 'paused', key: 'draft' };
  return { state: 'active', key: 'open' };
}

/**
 * The briefing: the header, size, files, checks and conflicts, the path to
 * merge with its one action, the brief the description leads with, and who
 * has reviewed it.
 */
export function PullRequestBriefing({
  address,
  onReviewChanges,
}: {
  address: PullRequestAddress;
  onReviewChanges: () => void;
}) {
  const { t } = useTranslation();
  const detail = usePullRequest(address);

  return (
    <QueryState
      query={detail}
      pending={<Skeleton className="h-96 w-full" />}
      errorFallback={t('pullRequests.detail.loadFailed')}
    >
      {(pull) => {
        const total = pull.additions + pull.deletions || 1;
        const state = stateOf(pull);
        const steps = mergeSteps(pull, t);
        const done = steps.filter((step) => step.state === 'done').length;
        const lead = leadOf(pull.body);
        return (
          <div className="flex flex-col gap-4">
            <PullRequestHeader
              state={state.state}
              stateLabel={t(`pullRequests.detail.state.${state.key}`)}
              lane={<LaneBadge lane={pull.lane} />}
              reference={pull.reference}
              title={pull.title}
              author={pull.author}
              authorKind={pull.authorKind}
              head={pull.headRef}
              base={pull.baseRef}
              labels={{ into: t('pullRequests.detail.into') }}
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label={t('pullRequests.detail.size')}
                value={<span className="text-success">+{pull.additions}</span>}
                unit={<span className="figures text-body text-danger">−{pull.deletions}</span>}
                bar={
                  <StatBar
                    segments={[
                      { share: Math.round((pull.additions / total) * 100), tone: 'success' },
                      { share: Math.round((pull.deletions / total) * 100), tone: 'danger' },
                    ]}
                  />
                }
              />
              <StatCard
                label={t('pullRequests.detail.files')}
                value={pull.changedFiles}
                unit={t('pullRequests.detail.inFolders', { count: pull.folders.length })}
              />
              <StatCard
                label={t('pullRequests.detail.checks')}
                value={
                  pull.checkCounts.total
                    ? `${pull.checkCounts.passed} / ${pull.checkCounts.total}`
                    : '—'
                }
                unit={
                  <span
                    className={
                      pull.checks === 'failing'
                        ? 'text-danger'
                        : pull.checks === 'passing'
                          ? 'text-success'
                          : undefined
                    }
                  >
                    {t(`pullRequests.checks.${pull.checks}`)}
                  </span>
                }
                bar={
                  pull.checkCounts.total ? (
                    <StatBar
                      track
                      segments={[
                        {
                          share: Math.round(
                            (pull.checkCounts.passed / pull.checkCounts.total) * 100,
                          ),
                          tone: 'success',
                        },
                        {
                          share: Math.round(
                            (pull.checkCounts.failed / pull.checkCounts.total) * 100,
                          ),
                          tone: 'danger',
                        },
                      ]}
                    />
                  ) : undefined
                }
              />
              <StatCard
                label={t('pullRequests.detail.conflicts')}
                icon={
                  pull.hasConflicts ? (
                    <span className="flex size-6.5 items-center justify-center self-center rounded-pill bg-danger/12 text-danger">
                      <CircleAlert className="size-3.75" aria-hidden />
                    </span>
                  ) : (
                    <span className="flex size-6.5 items-center justify-center self-center rounded-pill bg-success/15 text-success">
                      <CircleCheck className="size-3.75" aria-hidden />
                    </span>
                  )
                }
                value={
                  pull.hasConflicts
                    ? t('pullRequests.conflicts.some')
                    : t('pullRequests.detail.noneWord')
                }
                detail={t(
                  pull.hasConflicts
                    ? 'pullRequests.detail.withBase'
                    : 'pullRequests.detail.mergesCleanly',
                  {
                    base: pull.baseRef,
                  },
                )}
              />
            </div>
            <MergePath
              title={t('pullRequests.detail.pathToMerge')}
              summary={t('pullRequests.detail.gatesDone', { done, total: steps.length })}
              steps={steps}
              note={
                pull.state === 'merged'
                  ? t('pullRequests.detail.mergedInto', { base: pull.baseRef })
                  : pull.blocker
                    ? t(`pullRequests.blocker.${pull.blocker}`)
                    : pull.viewerLogin
                      ? t('pullRequests.detail.mergeNote', {
                          base: pull.baseRef,
                          login: pull.viewerLogin,
                        })
                      : t('pullRequests.detail.mergeNoteNoLogin')
              }
              actions={<MergeActions pull={pull} onReviewChanges={onReviewChanges} />}
            />
            <Panel title={t('pullRequests.detail.brief')}>
              <p className="m-0 max-w-prose text-body-lg text-pretty text-fg">
                {lead ?? t('pullRequests.detail.noDescription')}
              </p>
              <FactGrid>
                <FactTile label={t('pullRequests.detail.whatChanges')}>
                  {pull.folders.length
                    ? t('pullRequests.detail.where', { folders: folderList(pull.folders) })
                    : '—'}
                </FactTile>
                <FactTile label={t('pullRequests.detail.risk')}>
                  {t(`pullRequests.lanes.${pull.lane}`)}: {laneReasonText(pull, t)}
                </FactTile>
                <FactTile label={t('pullRequests.detail.checks')}>
                  {t(`pullRequests.checks.${pull.checks}`)}
                </FactTile>
              </FactGrid>
            </Panel>
            <PanelGrid>
              <Panel title={t('pullRequests.detail.reviewers')}>
                {pull.reviewers.length ? (
                  pull.reviewers.map((reviewer) => (
                    <ReviewerRow key={reviewer.login} reviewer={reviewer} />
                  ))
                ) : (
                  <p className="m-0 text-sm text-fg-muted">
                    {t('pullRequests.detail.noReviewers')}
                  </p>
                )}
              </Panel>
            </PanelGrid>
          </div>
        );
      }}
    </QueryState>
  );
}
