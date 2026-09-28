import {
  useInstallationRepositoriesFor,
  useInstallations,
  useRepositoryBranchesFor,
} from '@oppenheimer/frontend-consumer/react';
import { useDeploymentCapabilities, useErrorMessage } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { RepositoryBranchSelect } from '../components/repository-branch-select';
import { useManageGithubAccess } from '../hooks/use-manage-github-access';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { parseRepositoryKey, toRepositoryOptions } from '../lib/session-options';

/**
 * The repository chip, bound to the draft's scope.
 *
 * Four reads, all of them for this picker: the installations, their
 * repositories, whether the deployment has a GitHub App at all (the kernel's
 * capabilities read — cached and persisted, so it costs no request here) and
 * the branches of the repositories somebody has actually picked. The branches
 * are deliberately late: the API answers them live from GitHub, so a call per
 * row of a picker nobody has opened is a rate limit spent on nothing.
 *
 * "Manage repository access" is a mutation, not a link: the install URL it
 * opens carries a state minted on click (`useManageGithubAccess`), and a mint
 * that fails is shown under the chips.
 */
export function NewSessionRepositories() {
  const { t } = useTranslation();
  const { control } = useNewSessionDraft();
  const { field } = useController({ control, name: 'scope' });

  const resolveError = useErrorMessage();
  const installations = useInstallations();
  const installUrl = useDeploymentCapabilities({
    select: (deployment) => deployment.github_app_install_url,
  });
  const manageAccess = useManageGithubAccess();
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
    <>
      <RepositoryBranchSelect
        repositories={toRepositoryOptions(repositories.repositories, branches.byRepository, {
          archived: t('sessions.new.repository.archived'),
        })}
        value={field.value}
        onValueChange={field.onChange}
        onManage={installUrl.data ? manageAccess.manage : undefined}
        loading={installations.isPending || repositories.isPending || installUrl.isPending}
        branchesLoading={branches.isPending}
        failure={
          (installations.error ?? repositories.error)
            ? resolveError(
                installations.error ?? repositories.error,
                t('sessions.new.repository.failed'),
              ).message
            : undefined
        }
        variant="tab"
      />
      <ErrorAlert
        className="basis-full"
        error={manageAccess.error}
        fallback={t('sessions.new.repository.manageFailed')}
        onDismiss={manageAccess.dismiss}
      />
    </>
  );
}
