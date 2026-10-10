import {
  Button,
  Card,
  CardContent,
  CardFooter,
  PullRequestHeader,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { PencilIcon } from '@oppenheimer/design-system-web/icons';
import type { PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { usePullRequest } from '@oppenheimer/frontend-consumer/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { LaneBadge } from '../components/lane-badge';
import { MarkdownBody } from '../components/markdown-body';
import { PullRequestRail } from '../components/pull-request-rail';
import { pullState } from '../lib/briefing';
import { PullRequestActivity } from './pull-request-activity';
import { PullRequestCommentsSummary } from './pull-request-comments-summary';

/** The description on its card with its activity under it, and the rail beside them. */
export function PullRequestDescription({ address }: { address: PullRequestAddress }) {
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
              <PullRequestActivity address={address} base={pull.htmlUrl} />
            </div>
            <PullRequestRail
              pull={pull}
              comments={<PullRequestCommentsSummary address={address} />}
            />
          </div>
        );
      }}
    </QueryState>
  );
}
