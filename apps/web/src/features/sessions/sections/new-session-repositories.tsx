import type { RepositoryScope } from '@oppenheimer/design-system-web';
import {
  useInstallationRepositoriesFor,
  useInstallations,
  useRefreshInstallations,
  useRepositoryBranchesFor,
  useStartInstallation,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { ErrorAlert, useManageRepositoryAccess } from '@oppenheimer/frontend-web';
import { useRef } from 'react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { RepositoryBranchSelect } from '../components/repository-branch-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { parseRepositoryKey, pickOverCarried, toRepositoryOptions } from '../lib/session-options';

/**
 * The repository chip, bound to the draft's scope. Branches are read only for
 * picked repositories: the API answers them live from GitHub, so a call per
 * row of an unopened picker spends rate limit on nothing. "Manage repository
 * access" is a mutation, not a link, because its install URL carries a state
 * minted on click (`useManageRepositoryAccess`).
 *
 * What the screen opens on (the last session's repositories, or a project's
 * default) is carried, not chosen: the first repository picked over it takes
 * its place (`pickOverCarried`). Once this chip has written the selection,
 * picks add up; a project picked after resets it to carried again.
 */
export function NewSessionRepositories() {
  const { t } = useTranslation();
  const { control } = useNewSessionDraft();
  const { field } = useController({ control, name: 'scope' });
  // The ids this chip last wrote; a selection holding others was set elsewhere.
  const chosen = useRef<string | null>(null);

  function onValueChange(next: RepositoryScope[]) {
    const value = chosen.current === idsOf(field.value) ? next : pickOverCarried(field.value, next);
    chosen.current = idsOf(value);
    field.onChange(value);
  }

  const resolveError = useErrorMessage();
  const installations = useInstallations();
  const manageAccess = useManageRepositoryAccess(useStartInstallation(), useRefreshInstallations());
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
        onValueChange={onValueChange}
        onManage={manageAccess.onManage}
        loading={installations.isPending || repositories.isPending || manageAccess.isPending}
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
        fallback={t('common.repositoryAccess.failed')}
        onDismiss={manageAccess.dismiss}
      />
    </>
  );
}

function idsOf(scope: readonly RepositoryScope[]): string {
  return scope.map((item) => item.id).join(' ');
}
