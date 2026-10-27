import { StatusDot } from '@oppenheimer/design-system-web';
import type { CloudAgentStatus } from '@oppenheimer/shared/schemas/cloud-agent';
import { useTranslation } from 'react-i18next';
import { CLOUD_AGENT_DOT } from '../lib/cloud-agent-status';

/** Where an agent's latest run stands: the run-state dot and its word, breathing while it works. */
export function CloudAgentStatusDot({ status }: { status: CloudAgentStatus }) {
  const { t } = useTranslation();
  return (
    <StatusDot state={CLOUD_AGENT_DOT[status]} pulse={status === 'running'}>
      {t(`sessions.cloudAgents.status.${status}`)}
    </StatusDot>
  );
}
