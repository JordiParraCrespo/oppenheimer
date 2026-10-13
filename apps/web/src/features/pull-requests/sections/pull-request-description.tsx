import {
  Button,
  Card,
  CardContent,
  CardFooter,
  DiffStat,
  MergePath,
  PullRequestHeader,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { PencilIcon } from '@oppenheimer/design-system-web/icons';
import type { PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { usePullRequest } from '@oppenheimer/frontend-consumer/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { MarkdownBody } from '../components/markdown-body';
import { mergeSteps, pullState } from '../lib/merge-path';
import { MergeActions } from './merge-actions';

/**
 * The Description view: the header, the status strip (the size, the files,
 * Checks, Conflicts and Merge, with Review changes and Merge), then the
 * author's own description, as GitHub has it.
 */
export function PullRequestDescription({
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
        const state = pullState(pull);
        return (
          <div className="flex flex-col gap-4">
            <PullRequestHeader
              state={state.state}
              stateLabel={t(`pullRequests.detail.state.${state.key}`)}
              reference={pull.reference}
              title={pull.title}
              author={pull.author}
              authorKind={pull.authorKind}
              head={pull.headRef}
              base={pull.baseRef}
              labels={{ into: t('pullRequests.detail.into') }}
            />
            <MergePath
              leading={
                <>
                  <DiffStat additions={pull.additions} deletions={pull.deletions} />
                  <span>
                    {t('pullRequests.detail.filesIn', {
                      count: pull.changedFiles,
                      folders: t('pullRequests.detail.inFolders', { count: pull.folders.length }),
                    })}
                  </span>
                </>
              }
              steps={mergeSteps(pull, t)}
              actions={<MergeActions pull={pull} onReviewChanges={onReviewChanges} />}
            />
            <Card>
              <CardContent>
                {pull.body.trim() ? (
                  <MarkdownBody source={pull.body} base={pull.htmlUrl} />
                ) : (
                  <p className="m-0 text-body text-fg-muted">
                    {t('pullRequests.detail.noDescription')}
                  </p>
                )}
              </CardContent>
              <CardFooter className="justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<a href={pull.htmlUrl} target="_blank" rel="noreferrer" />}
                >
                  <PencilIcon />
                  {t('pullRequests.detail.editOnGithub')}
                </Button>
              </CardFooter>
            </Card>
          </div>
        );
      }}
    </QueryState>
  );
}
