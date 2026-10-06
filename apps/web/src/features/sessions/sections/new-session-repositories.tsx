import {
  useInstallationRepositoriesFor,
  useInstallations,
  useManageGithubAccess,
  useRepositoryBranchesFor,
} from '@oppenheimer/frontend-consumer/react';
import { useDeploymentCapabilities, useErrorMessage } from '@oppenheimer/frontend-core/react';
import { ErrorAlert, openPendingTab } from '@oppenheimer/frontend-web';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { RepositoryBranchSelect } from '../components/repository-branch-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { parseRepositoryKey, toRepositoryOptions } from '../lib/session-options';

/**
 * The repository chip, bound to the draft's scope. Branches are read only for
 * picked repositories: the API answers them live from GitHub, so a call per
 * row of an unopened picker spends rate limit on nothing. "Manage repository
 * access" is a mutation, not a link, because its install URL carries a state
 * minted on click (`useManageGithubAccess`).
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
  const manageAccess = useManageGithubAccess(openPendingTab);
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
