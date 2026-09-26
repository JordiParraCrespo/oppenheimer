import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useHostsSnapshot, useProjects } from '@oppenheimer/frontend-consumer/react';
import { useNavigate } from '@tanstack/react-router';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ProjectSelect } from '../components/project-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { projectPrefill, toProjectOptions } from '../lib/session-options';

/**
 * The project chip, bound to the draft: first in the scope band, because
 * picking a project prefills the host, the repository and the agent
 * (`product/versions/mvp/05-screens.md`).
 *
 * It subscribes to the projects because it draws them. The hosts it only
 * reads at pick time, to know which project default is still a machine this
 * workspace has, so a refetch of the host list does not re-render it.
 *
 * With no project picked it shows the workspace's Unassigned project, which is
 * where the API lists a session that names none — so what the chip says and
 * where the session lands never disagree. New project… is a page: it comes
 * back here with what it made (`?project=`), and the draft starts on it.
 */
export function NewSessionProject() {
  const { t } = useTranslation();
  const { control, setValue } = useNewSessionDraft();
  const { field } = useController({ control, name: 'projectId' });
  const navigate = useNavigate();

  const projects = useProjects();
  const hosts = useHostsSnapshot();

  // A remembered project the workspace no longer has, or one not yet loaded,
  // is shown as Unassigned rather than as an id: the list is the truth once it
  // answers, and only then is "that project is gone" a fact. The send leaves
  // such an id out, and the API lists the session in Unassigned.
  const value = projects.data?.some((project) => project.id === field.value)
    ? field.value
    : (projects.data?.find((project) => project.isUnassigned)?.id ?? null);

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

  return (
    <ProjectSelect
      projects={toProjectOptions(projects.data ?? [], {
        noRepositories: t('sessions.new.project.noRepositories'),
        unassigned: t('projects.unassigned'),
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
