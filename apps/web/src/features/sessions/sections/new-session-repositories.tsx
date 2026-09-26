import {
  useInstallationRepositoriesFor,
  useInstallations,
  useRepositoryBranchesFor,
} from '@oppenheimer/frontend-consumer/react';
import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { RepositoryBranchSelect } from '../components/repository-branch-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { parseRepositoryKey, toRepositoryOptions } from '../lib/session-options';

/**
 * The repository chip, bound to the draft's scope.
 *
 * Four reads, all of them for this picker: the installations, their
 * repositories, the deployment's GitHub App install URL (the kernel's
 * capabilities read — cached and persisted, so it costs no request here) and
 * the branches of the repositories somebody has actually picked. The branches
 * are deliberately late: the API answers them live from GitHub, so a call per
 * row of a picker nobody has opened is a rate limit spent on nothing.
 */
export function NewSessionRepositories() {
  const { t } = useTranslation();
  const { control } = useNewSessionDraft();
  const { field } = useController({ control, name: 'scope' });

  const installations = useInstallations();
  const installUrl = useDeploymentCapabilities({
    select: (deployment) => deployment.github_app_install_url,
  });
  const repositories = useInstallationRepositoriesFor(
    (installations.data ?? []).map((installation) => installation.id),
  );
  const branches = useRepositoryBranchesFor(
    field.value.flatMap((scope) => {
      const ref = parseRepositoryKey(scope.id);
      return ref ? [ref] : [];
    }),
  );

  return (
    <RepositoryBranchSelect
      repositories={toRepositoryOptions(repositories.repositories, branches.byRepository, {
        archived: t('sessions.new.repository.archived'),
      })}
      value={field.value}
      onValueChange={field.onChange}
      manageUrl={installUrl.data ?? null}
      loading={installations.isPending || repositories.isPending || installUrl.isPending}
      branchesLoading={branches.isPending}
      variant="tab"
    />
  );
}
