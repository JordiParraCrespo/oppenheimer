import {
  useInstallationRepositoriesFor,
  useInstallations,
} from '@oppenheimer/frontend-consumer/react';
import { useWatch } from 'react-hook-form';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { isHostCloud, parseRepositoryKey } from '../lib/session-options';
import { NewSessionCodexEnvironmentPicker } from './new-session-codex-environment-picker';

/**
 * Whether a Codex cloud session's environment chip is drawn: only for Codex's
 * cloud started from a host, with one repository picked and its full name
 * known. Codex runs the task in one of the ChatGPT account's environments; the
 * host picks the one linked to the repository, and this chip is how another is
 * picked (`product/next-steps/cloud-agents.md`, "Which Codex environment").
 *
 * The repository's name comes off the same cached list the repository chip
 * reads, so it costs no request. The picker is its own section, rendered only
 * once there is a host and a repository to ask about.
 */
export function NewSessionCodexEnvironment() {
  const { control } = useNewSessionDraft();
  const [where, cloudProvider, agent, hostId, scope] = useWatch({
    control,
    name: ['where', 'cloudProvider', 'agent', 'hostId', 'scope'],
  });
  const codexCloud = isHostCloud({ where, cloudProvider }) && agent === 'codex';
  const only = codexCloud && scope.length === 1 ? scope[0] : undefined;
  const ref = only ? parseRepositoryKey(only.id) : null;

  const installations = useInstallations();
  const repositories = useInstallationRepositoriesFor(
    ref ? (installations.data ?? []).map((installation) => installation.id) : [],
  );
  const repository = ref
    ? repositories.repositories.find(
        (row) =>
          row.installationId === ref.installationId &&
          row.repository.githubRepoId === ref.githubRepoId,
      )?.repository
    : undefined;

  if (!only || !hostId || !repository) return null;
  return (
    <NewSessionCodexEnvironmentPicker
      hostId={hostId}
      repositoryId={only.id}
      repository={repository.fullName}
    />
  );
}
