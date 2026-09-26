import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useHosts, useProjects } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ProjectSelect } from '../components/project-select';
import { ProjectDialog } from '../dialogs/project';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { projectPrefill, toProjectOptions } from '../lib/session-options';

/**
 * The project chip, bound to the draft: first in the scope band, because
 * picking a project prefills the host, the repository and the agent
 * (`product/versions/mvp/12-projects-on-the-console.md`).
 *
 * It reads the projects because it draws them, and the hosts only to know
 * which project default is still a machine this workspace has. New
 * project… is this chip's dialog: what it makes is picked here.
 */
export function NewSessionProject() {
  const { t } = useTranslation();
  const { control, setValue } = useNewSessionDraft();
  const { field } = useController({ control, name: 'projectId' });
  const [creating, setCreating] = useState(false);

  const projects = useProjects();
  const hosts = useHosts();

  // A remembered project the workspace no longer has, or one not yet loaded,
  // is shown as none rather than as an id: the list is the truth once it
  // answers, and only then is "that project is gone" a fact.
  const value = projects.data?.some((project) => project.id === field.value) ? field.value : null;

  /** Picking a project: the chip, then what its defaults set on the others. */
  function pick(next: ProjectEntity) {
    field.onChange(next.id);
    const prefill = projectPrefill(
      next,
      (hosts.data ?? []).map((host) => host.id),
    );
    if (prefill.hostId !== undefined) setValue('hostId', prefill.hostId);
    if (prefill.scope !== undefined) setValue('scope', prefill.scope);
    if (prefill.agent !== undefined) setValue('agent', prefill.agent);
    if (prefill.model !== undefined) setValue('model', prefill.model);
  }

  return (
    <>
      <ProjectSelect
        projects={toProjectOptions(projects.data ?? [], {
          noRepositories: t('sessions.new.project.noRepositories'),
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

      {creating ? (
        <ProjectDialog
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            pick(created);
            setCreating(false);
          }}
        />
      ) : null}
    </>
  );
}
