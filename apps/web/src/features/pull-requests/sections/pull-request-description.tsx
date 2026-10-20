import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Prose,
  PullRequestHeader,
} from '@oppenheimer/design-system-web';
import { PencilIcon } from '@oppenheimer/design-system-web/icons';
import type { PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { useSuspensePullRequest } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, Markdown, QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { CommentersSkeleton } from '../components/commenters-skeleton';
import { LaneBadge } from '../components/lane-badge';
import { PullRequestRail } from '../components/pull-request-rail';
import { pullState } from '../lib/pull-state';
import { PullRequestCommentsSummary } from './pull-request-comments-summary';

/**
 * The description on its card, and the rail beside it: merge status, comments,
 * reviews, checks. Read under Suspense: the screen's `QueryState` draws the
 * placeholder and a first failure; a refetch that fails keeps the page and
 * says so above it. The rail's comments are a read of their own, with a
 * `QueryState` of their own, so a slow conversation does not hold the page.
 */
export function PullRequestDescription({ address }: { address: PullRequestAddress }) {
  const { t } = useTranslation();
  const { data: pull, error } = useSuspensePullRequest(address);
  const state = pullState(pull);
  return (
    <div className="flex flex-col gap-6">
      <ErrorAlert error={error} fallback={t('pullRequests.detail.loadFailed')} />
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-14">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
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
          <Card>
            <CardContent>
              {pull.body.trim() ? (
                <Prose className="max-w-none">
                  <Markdown source={pull.body} base={pull.htmlUrl} />
                </Prose>
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
        <PullRequestRail
          pull={pull}
          comments={
            <QueryState>
              <QueryState.Pending>
                <CommentersSkeleton />
              </QueryState.Pending>
              <QueryState.Error fallback={t('pullRequests.detail.rail.commentsFailed')} />
              <QueryState.Data>
                <PullRequestCommentsSummary address={address} />
              </QueryState.Data>
            </QueryState>
          }
        />
      </div>
    </div>
  );
}
