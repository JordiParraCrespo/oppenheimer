import { RoutineItem } from '@oppenheimer/design-system-web';
import { Cloud } from '@oppenheimer/design-system-web/icons';
import type { CloudAgentEntity } from '@oppenheimer/frontend-consumer';
import { formatAge } from '@oppenheimer/frontend-web';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * One cloud agent in the sidebar: its name, its glyph green while it works,
 * and its age; a run that ended badly carries the failed dot. A section
 * because it reads the route. `now` is the list's one minute clock.
 */
export function CloudAgentRow({ agent, now }: { agent: CloudAgentEntity; now: number }) {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const lastRun =
    agent.status === 'failed' ? 'failed' : agent.status === 'finished' ? 'completed' : undefined;
  return (
    <RoutineItem
      name={agent.name}
      icon={<Cloud />}
      running={agent.isActive}
      meta={formatAge(agent.createdAt, now, t)}
      lastRun={lastRun}
      lastRunLabel={t(`sessions.cloudAgents.status.${agent.status}`)}
      active={Boolean(matchRoute({ to: '/cloud/$agentId', params: { agentId: agent.id } }))}
      render={<Link to="/cloud/$agentId" params={{ agentId: agent.id }} />}
    />
  );
}
