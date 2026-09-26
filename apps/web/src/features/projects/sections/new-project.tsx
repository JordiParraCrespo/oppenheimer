import { parseRepositoryKey } from '@oppenheimer/frontend-consumer';
import {
  useCreateProject,
  useHosts,
  useInstallationRepositoriesFor,
  useInstallations,
  useRepositoryBranchesFor,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectForm } from '../forms/project-form';
import { toRepositoryRows } from '../lib/project-rows';

/**
 * What New project reads and saves, around the form that draws it.
 *
 * Three reads, each one the form renders: the installations' repositories are
 * the rows, the branches of the ticked rows are the pills, the hosts are the
 * chips. The branches are deliberately late, as on New session's repository
 * chip — a call per row nobody ticked is a rate limit spent on nothing — so
 * the ticked ids live here, where the read is.
 *
 * Creating goes back to New session with the project named in the URL; the
 * create put it in the list cache first, so the draft starts on it with its
 * defaults applied.
 */
export function NewProject({ crumbs }: { crumbs: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolveError = useErrorMessage();
  const [ticked, setTicked] = useState<string[]>([]);

  const hosts = useHosts({
    select: (rows) => rows.map((host) => ({ id: host.id, name: host.name })),
  });
  const installations = useInstallations();
  const repositories = useInstallationRepositoriesFor(
    (installations.data ?? []).map((installation) => installation.id),
  );
  const branches = useRepositoryBranchesFor(
    ticked.flatMap((id) => {
      const ref = parseRepositoryKey(id);
      return ref ? [ref] : [];
    }),
  );

  const create = useCreateProject({
    onSuccess: (project) =>
      navigate({ to: '/sessions/new', search: { project: project.id }, replace: true }),
  });

  return (
    <ProjectForm
      crumbs={crumbs}
      repositories={toRepositoryRows(repositories.repositories, branches.byRepository)}
      repositoriesLoading={installations.isPending || repositories.isPending}
      hosts={hosts.data ?? []}
      hostsLoading={hosts.isPending}
      isPending={create.isPending}
      error={
        create.isError ? resolveError(create.error, t('projects.new.failed')).message : undefined
      }
      onCancel={() => navigate({ to: '/sessions/new' })}
      onRepositoriesChange={setTicked}
      onSubmit={(values) => create.mutate({ ...values, name: values.name.trim() })}
    />
  );
}
