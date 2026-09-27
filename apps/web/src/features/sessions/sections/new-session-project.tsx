import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useHosts, useHostsSnapshot, useProjects } from '@oppenheimer/frontend-consumer/react';
import { useSearch } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ProjectSelect } from '../components/project-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { useSearchPick } from '../hooks/use-search-pick';
import { projectPrefill, toProjectOptions } from '../lib/session-options';

/**
 * The dialog loads when first opened: New session is the console's landing
 * screen, and making a project is the rare path through it.
 */
const ProjectDialog = lazy(() =>
  import('../dialogs/project').then((module) => ({ default: module.ProjectDialog })),
);

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
 * gone. New project… opens the project dialog over the console, and what it
 * makes comes straight back to this chip, picked with its defaults. The
 * sidebar's "New session here" names a project in the address instead
 * (`?project=`), and the chip picks that once the lists can.
 */
export function NewSessionProject() {
  const { t } = useTranslation();
  const { control, setValue } = useNewSessionDraft();
  const { field } = useController({ control, name: 'projectId' });
  const [creating, setCreating] = useState(false);

  const search = useSearch({ from: '/_authenticated/sessions/new' });
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

  // The sidebar's "New session here" names the project in the address.
  useSearchPick(search.project, projects.data, hostsReady === true, pick);

  return (
    <>
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
        onNewProject={() => setCreating(true)}
        loading={projects.isPending}
        variant="tab"
      />
      <Suspense fallback={null}>
        {creating ? <ProjectDialog onClose={() => setCreating(false)} onCreated={pick} /> : null}
      </Suspense>
    </>
  );
}
