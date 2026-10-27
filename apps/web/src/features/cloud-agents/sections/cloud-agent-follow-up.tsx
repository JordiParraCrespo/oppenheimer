import { useFollowUpCloudAgent } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudAgentFollowUpForm } from '../forms/cloud-agent-follow-up-form';

/**
 * The next instruction for an agent: a new run at the vendor. While a run is
 * going the vendor refuses one, so the form is off and says why. A send that
 * worked starts a fresh form (its `key`); one that failed keeps the words.
 */
export function CloudAgentFollowUp({ agentId, working }: { agentId: string; working: boolean }) {
  const { t } = useTranslation();
  const [sent, setSent] = useState(0);
  const followUp = useFollowUpCloudAgent(agentId, {
    onSuccess: () => setSent((count) => count + 1),
  });
  return (
    <section className="flex flex-col gap-3">
      <ErrorAlert
        error={followUp.error}
        fallback={t('sessions.cloudAgents.detail.followUpFailed')}
        onDismiss={() => followUp.reset()}
      />
      <CloudAgentFollowUpForm
        key={sent}
        disabledReason={working ? t('sessions.cloudAgents.detail.followUpWhileWorking') : undefined}
        pending={followUp.isPending}
        onSubmit={(prompt) => followUp.mutate(prompt)}
      />
    </section>
  );
}
