import {
  Avatar,
  AvatarFallback,
  StatusDot,
  type StatusState,
} from '@oppenheimer/design-system-web';
import type { PullRequestReviewer } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

const STATE: Record<PullRequestReviewer['state'], StatusState> = {
  approved: 'completed',
  changes_requested: 'blocked',
  commented: 'idle',
  requested: 'needs-input',
};

export function ReviewerRow({ reviewer }: { reviewer: PullRequestReviewer }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5 text-operate">
      <Avatar size="sm">
        <AvatarFallback>{reviewer.login.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-fg">@{reviewer.login}</span>
      <StatusDot state={STATE[reviewer.state]} density="compact">
        {t(`pullRequests.detail.reviewer.${reviewer.state}`)}
      </StatusDot>
    </div>
  );
}
