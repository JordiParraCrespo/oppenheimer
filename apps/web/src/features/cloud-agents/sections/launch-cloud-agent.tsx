import {
  useCloudAgentModels,
  useCloudAgentRepositories,
  useLaunchCloudAgent,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import type { CloudAgentProviderId } from '@oppenheimer/shared/schemas/cloud-agent';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { LaunchCloudAgentForm } from '../forms/launch-cloud-agent-form';

/**
 * Launching on one vendor: the repositories and models it offers the reader
 * (each a picker that stays on screen while it loads), and the launch, which
 * opens the agent's page once the vendor has it. A list that could not be
 * read says so above the form; the picker stays, empty.
 */
export function LaunchCloudAgent({
  provider,
  label,
}: {
  provider: CloudAgentProviderId;
  label: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const repositories = useCloudAgentRepositories(provider);
  const models = useCloudAgentModels(provider);
  const launch = useLaunchCloudAgent({
    onSuccess: (agent) => navigate({ to: '/cloud/$agentId', params: { agentId: agent.id } }),
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-fg-muted">
        {t('sessions.cloudAgents.landing.description', { provider: label })}
      </p>
      <ErrorAlert
        error={repositories.error}
        fallback={t('sessions.cloudAgents.launch.repositoriesFailed', { provider: label })}
      />
      <ErrorAlert
        error={models.error}
        fallback={t('sessions.cloudAgents.launch.modelsFailed', { provider: label })}
      />
      <ErrorAlert
        error={launch.error}
        fallback={t('sessions.cloudAgents.launch.failed')}
        onDismiss={() => launch.reset()}
      />
      <LaunchCloudAgentForm
        provider={provider}
        providerLabel={label}
        repositories={repositories.data ?? []}
        repositoriesLoading={repositories.isPending}
        models={models.data ?? []}
        modelsLoading={models.isPending}
        pending={launch.isPending}
        onSubmit={(input) => launch.mutate(input)}
      />
    </div>
  );
}
