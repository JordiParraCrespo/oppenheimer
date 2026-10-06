import { Skeleton } from '@oppenheimer/design-system-web';
import type { PullRequestAddress } from '@oppenheimer/frontend-consumer';
import { usePullRequest } from '@oppenheimer/frontend-consumer/react';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { MarkdownBody } from '../components/markdown-body';

/** The description, as its author wrote it. */
export function PullRequestDescription({ address }: { address: PullRequestAddress }) {
  const { t } = useTranslation();
  const detail = usePullRequest(address);
  return (
    <QueryState
      query={detail}
      pending={<Skeleton className="mx-auto h-64 w-full max-w-prose" />}
      errorFallback={t('pullRequests.detail.loadFailed')}
    >
      {(pull) => (
        <MarkdownBody
          title={pull.title}
          source={pull.body || t('pullRequests.detail.noDescription')}
        />
      )}
    </QueryState>
  );
}
