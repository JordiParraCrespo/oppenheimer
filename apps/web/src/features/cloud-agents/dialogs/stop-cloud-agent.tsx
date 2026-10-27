import { useCancelCloudAgent } from '@oppenheimer/frontend-consumer/react';
import { ConfirmDialog } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** Stop an agent's run. What it pushed stays; a next instruction starts it again. */
export function StopCloudAgentDialog({
  agentId,
  name,
  onClose,
}: {
  agentId: string;
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const stop = useCancelCloudAgent(agentId, { onSuccess: onClose });
  return (
    <ConfirmDialog
      title={t('sessions.cloudAgents.stop.title', { name })}
      description={t('sessions.cloudAgents.stop.description')}
      confirmLabel={t('sessions.cloudAgents.stop.confirm')}
      pendingLabel={t('sessions.cloudAgents.stop.pending')}
      pending={stop.isPending}
      error={stop.error}
      errorFallback={t('sessions.cloudAgents.stop.failed')}
      onClose={onClose}
      onConfirm={() => stop.mutate()}
    />
  );
}
