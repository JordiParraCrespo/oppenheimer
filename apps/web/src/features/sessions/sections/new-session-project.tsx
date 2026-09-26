import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useHosts, useHostsSnapshot, useProjects } from '@oppenheimer/frontend-consumer/react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ProjectSelect } from '../components/project-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { useSearchPick } from '../hooks/use-search-pick';
import { projectPrefill, toProjectOptions } from '../lib/session-options';

/**
 * The project chip, bound to the draft: first in the scope band, because
 * picking a project prefills the host, the repository and the agent
 * (`product/versions/mvp/12-projects-on-the-console.md`).
 *
 * It subscribes to the projects because it draws them. The hosts it only
 * reads at pick time, to know which project default is still a machine this
 * workspace has, so a refetch of the host list does not re-render it — what
 * it subscribes to is only whether that list has answered, because a pick
 * made before it has would drop the project's default host as if it were
 * gone. New project… is the project page (`/projects/new`), which lands back
 * here with what it made in the address — the same `?project=` the sidebar's
 * "New session here" names — and the chip picks it once the lists can.
 */
export function NewSessionProject() {
  const { t } = useTranslation();
  const { control, setValue } = useNewSessionDraft();
  const { field } = useController({ control, name: 'projectId' });
  const navigate = useNavigate();

  const search = useSearch({ from: '/_authenticated/sessions/new' });
  const projects = useProjects();
  const hosts = useHostsSnapshot();
  // A boolean that flips once, so the settle re-renders this chip once and a
  // refetch that changes the rows never does.
  const { data: hostsReady } = useHosts({ select: () => true });

  // A remembered project the workspace no longer has, or one not yet loaded,
  // is shown as none rather than as an id: the list is the truth once it
  // answers, and only then is "that project is gone" a fact.
  const value = projects.data?.some((project) => project.id === field.value) ? field.value : null;

  /** Picking a project: the chip, then what its defaults set on the others. */
  function pick(next: ProjectEntity) {
    field.onChange(next.id);
    const prefill = projectPrefill(
      next,
      (hosts() ?? []).map((host) => host.id),
    );
    if (prefill.hostId !== undefined) setValue('hostId', prefill.hostId);
    if (prefill.scope !== undefined) setValue('scope', prefill.scope);
    if (prefill.agent !== undefined) setValue('agent', prefill.agent);
    if (prefill.model !== undefined) setValue('model', prefill.model);
  }

  // The sidebar's "New session here" names the project in the address.
  useSearchPick(search.project, projects.data, hostsReady === true, pick);

  return (
    <ProjectSelect
      projects={toProjectOptions(projects.data ?? [], {
        noRepositories: t('sessions.new.project.noRepositories'),
      })}
      value={value}
      onValueChange={(id) => {
        const next = projects.data?.find((candidate) => candidate.id === id);
        if (next) pick(next);
      }}
      onNewProject={() => navigate({ to: '/projects/new' })}
      loading={projects.isPending}
      variant="tab"
    />
  );
}
