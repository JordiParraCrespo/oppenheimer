import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import { useHosts, useHostsSnapshot, useProjects } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { ProjectSelect } from '../components/project-select';
import { useLandingPick } from '../hooks/use-landing-pick';
import { useLandingFillable, useNewSessionDraft } from '../hooks/use-new-session-form';
import { useSearchPick } from '../hooks/use-search-pick';
import { onlyFields, PROJECT_FILLED, type ProjectFilled } from '../lib/new-session-draft';
import { projectPrefill, toProjectOptions } from '../lib/session-options';

/**
 * The project chip, over New session's box because picking a project
 * prefills the host, the repository and the agent
 * (`product/versions/mvp/05-screens.md`); for a folder session it is
 * optional and only files the session (24). The hosts are read only at pick
 * time, so a host refetch does not re-render it; it subscribes only to whether
 * that list has answered, because a pick before then would drop the project's
 * default host as if it were gone.
 */
export function NewSessionProject() {
  const { t } = useTranslation();
  const { control, setValue, getValues } = useNewSessionDraft();
  const { field } = useController({ control, name: 'projectId' });
  const dialogs = useConsoleDialog();
  const [created, setCreated] = useState<string | undefined>();
  const fillable = useLandingFillable();

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

  /** File the draft under the project and offer the chips `fields` of its defaults. */
  function apply(next: ProjectEntity, fields: readonly ProjectFilled[]) {
    field.onChange(next.id);
    // A folder session only files itself under the project: it clones none of
    // its repositories, and its host and agent are already the folder's.
    if (getValues('where') === 'folder') return;
    const prefill = onlyFields(
      projectPrefill(
        next,
        (hosts() ?? []).map((host) => host.id),
      ),
      fields,
    );
    if (prefill.hostId !== undefined) setValue('hostId', prefill.hostId);
    if (prefill.scope !== undefined) setValue('scope', prefill.scope);
    if (prefill.agent !== undefined) setValue('agent', prefill.agent);
    if (prefill.model !== undefined) setValue('model', prefill.model);
  }

  /** A project picked on the screen or named by the address: all its defaults. */
  const pick = (next: ProjectEntity) => apply(next, PROJECT_FILLED);

  // The sidebar's "New session here" names the project in the address; the
  // dialog names the one it made. Either is picked once the lists can.
  useSearchPick(created ?? search.project, projects.data, hostsReady === true, pick);

  // With neither, the project the chip starts on — remembered, or Unassigned —
  // fills only the chips the last visit left empty: the last choice wins over
  // the project's default, so a visit opens on what was picked last.
  useLandingPick(value, projects.data, hostsReady === true, Boolean(search.project), (next) =>
    apply(next, fillable),
  );

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
