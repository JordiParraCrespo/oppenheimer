import { StatusDot, type StatusState } from '@oppenheimer/design-system-web';
import type { PullRequestReviewer } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { PersonRow } from './person-row';

const STATE: Record<PullRequestReviewer['state'], StatusState> = {
  approved: 'completed',
  changes_requested: 'blocked',
  commented: 'idle',
  requested: 'needs-input',
};

export function ReviewerRow({ reviewer }: { reviewer: PullRequestReviewer }) {
  const { t } = useTranslation();
  return (
    <PersonRow
      login={reviewer.login}
      aside={
        <StatusDot state={STATE[reviewer.state]} density="compact">
          {t(`pullRequests.detail.reviewer.${reviewer.state}`)}
        </StatusDot>
      }
    />
  );
}
