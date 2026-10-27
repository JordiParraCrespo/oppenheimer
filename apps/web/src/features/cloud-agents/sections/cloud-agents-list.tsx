import { useNow } from '@oppenheimer/design-system-web';
import { useSuspenseCloudAgents } from '@oppenheimer/frontend-consumer/react';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { CloudAgentRow } from './cloud-agent-row';

/**
 * The reader's cloud agents, newest first, one row each. The read polls while
 * one of them works; one minute clock serves every row's age. With none yet,
 * nothing is drawn under the head: New cloud agent is right above it.
 */
export function CloudAgentsList() {
  const { t } = useTranslation();
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);
  const { data: agents, error } = useSuspenseCloudAgents();
  return (
    <div className="flex flex-col gap-0.5 px-3">
      <ErrorAlert error={error} fallback={t('sessions.cloudAgents.sidebar.listFailed')} />
      {agents.map((agent) => (
        <CloudAgentRow key={agent.id} agent={agent} now={now} />
      ))}
    </div>
  );
}
