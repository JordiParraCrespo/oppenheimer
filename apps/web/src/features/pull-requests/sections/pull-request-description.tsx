import { Card, PullRequestHeader, Skeleton } from '@oppenheimer/design-system-web';
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

/**
 * The description, as its author wrote it, laid out the way the Codex app
 * lays out a pull request: the header, the description on a card under it
 * with a way to edit it on GitHub and its conversation under that, and beside it the
 * rail of what decides the merge.
 */
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
              <Card padded>
                {pull.body.trim() ? (
                  <MarkdownBody source={pull.body} base={pull.htmlUrl} />
                ) : (
                  <p className="m-0 text-body text-fg-muted">
                    {t('pullRequests.detail.noDescription')}
                  </p>
                )}
                <div className="mt-5 flex justify-end border-t border-border-subtle pt-4">
                  <a
                    href={pull.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
                  >
                    <PencilIcon className="size-3.5" aria-hidden />
                    {t('pullRequests.detail.editOnGithub')}
                  </a>
                </div>
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
