import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useHosts, useHostsSnapshot, useProjects } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { ProjectSelect } from '../components/project-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { useSearchPick } from '../hooks/use-search-pick';
import { projectPrefill, toProjectOptions } from '../lib/session-options';

/**
 * The project chip, bound to the draft: first in the scope band, because
 * picking a project prefills the host, the repository and the agent
 * (`product/versions/mvp/05-screens.md`).
 *
 * It subscribes to the projects because it draws them. The hosts it only
 * reads at pick time, to know which project default is still a machine this
 * workspace has, so a refetch of the host list does not re-render it — what
 * it subscribes to is only whether that list has answered, because a pick
 * made before it has would drop the project's default host as if it were
 * gone. New project… asks the console for its project dialog; what it
 * makes is picked here once the list holds it, its defaults applied, the
 * same way the sidebar's "New session here" names one in the address. With
 * nothing in the address, the project the screen starts on — remembered, or
 * Unassigned — has its defaults applied too, so the draft a visit opens with
 * is always the one its project describes.
 */
export function NewSessionProject() {
  const { t } = useTranslation();
  const { control, setValue } = useNewSessionDraft();
  const { field } = useController({ control, name: 'projectId' });
  const dialogs = useConsoleDialog();
  // The project the dialog just made, picked below once the list holds it.
  const [created, setCreated] = useState<string | undefined>();

  const search = useSearch({ from: '/_authenticated/sessions/new' });
  const resolveError = useErrorMessage();
  const projects = useProjects();
  const hosts = useHostsSnapshot();
  // A boolean that flips once, so the settle re-renders this chip once and a
  // refetch that changes the rows never does.
  const { data: hostsReady } = useHosts({ select: () => true });

  // A remembered project the workspace no longer has, or one not yet loaded,
  // is shown as Unassigned rather than as an id: the list is the truth once it
  // answers, and only then is "that project is gone" a fact. The send leaves
  // such an id out, and the API lists the session in Unassigned — so what the
  // chip says and where the session lands never disagree.
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

  // The sidebar's "New session here" names the project in the address; the
  // dialog names the one it made. Either is picked once the lists can, and
  // with neither, the project the chip starts on is, on arrival.
  useSearchPick(created ?? search.project, projects.data, hostsReady === true, pick, value);

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
      onNewProject={() =>
        dialogs.open({ kind: 'project', onSaved: (project) => setCreated(project.id) })
      }
      loading={projects.isPending}
      failure={
        projects.isError
          ? resolveError(projects.error, t('sessions.new.project.failed')).message
          : undefined
      }
      variant="tab"
    />
  );
}
