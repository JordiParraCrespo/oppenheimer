import { Badge } from '@oppenheimer/design-system-web';
import type { PullRequestLane } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/** The lane, the one dark badge for Deep: the reading the change needs. */
export function LaneBadge({ lane }: { lane: PullRequestLane }) {
  const { t } = useTranslation();
  return (
    <Badge variant={lane === 'deep' ? 'strong' : 'soft'}>{t(`pullRequests.lanes.${lane}`)}</Badge>
  );
}
