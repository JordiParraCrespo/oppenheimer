import { Field, FieldDescription, FieldLabel, FieldSelect } from '@oppenheimer/design-system-web';
import { repositoryKey } from '@oppenheimer/frontend-consumer';
import { useHosts, useProjects } from '@oppenheimer/frontend-consumer/react';
import { CODING_AGENTS, type CodingAgentId } from '@oppenheimer/shared/agents';
import { useTranslation } from 'react-i18next';
import { AUTOMATION_AGENTS, type AutomationDraft } from '../lib/automation-draft';

const DEFAULT_MODEL = '__default__';

type WherePatch = Partial<
  Pick<AutomationDraft, 'projectId' | 'repositoryKeys' | 'hostId' | 'agent' | 'model'>
>;

/**
 * The editor's Where it runs step: Code (the project and which of its
 * repositories), then Runs on (the host, the agent, its model). A run clones
 * only from the project, so the repositories offered are the project's; a new
 * project picks all of them.
 */
export function EditorWhereStep({
  draft,
  onChange,
}: {
  draft: AutomationDraft;
  onChange: (patch: WherePatch) => void;
}) {
  const { t } = useTranslation();
  const { data: projects = [] } = useProjects({
    select: (rows) => rows.filter((row) => !row.isUnassigned),
  });
  const { data: hosts = [] } = useHosts();
  const project = projects.find((row) => row.id === draft.projectId);
  const repositoryOptions = (project?.repositories ?? []).map((repository) => ({
    value: repositoryKey({
      installationId: repository.installationId,
      githubRepoId: repository.githubRepoId,
    }),
    label: repository.fullName,
    description: t('automations.editor.inProject', { name: project?.name ?? '' }),
  }));
  const models = CODING_AGENTS[draft.agent].models;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <span className="eyebrow">{t('automations.editor.code')}</span>
        <Field>
          <FieldLabel>{t('automations.editor.project')}</FieldLabel>
          <FieldSelect
            aria-label={t('automations.editor.project')}
            placeholder={t('automations.editor.chooseProject')}
            searchPlaceholder={t('automations.editor.searchProjects')}
            emptyText={(query) => t('automations.editor.noMatch', { query })}
            value={draft.projectId}
            meta={project ? String(project.repositories.length) : undefined}
            options={projects.map((row) => ({
              value: row.id,
              label: row.name,
              description:
                row.repositories.map((repository) => repository.fullName).join(', ') ||
                t('automations.editor.noRepositories'),
            }))}
            onValueChange={(projectId) => {
              const next = projects.find((row) => row.id === projectId);
              onChange({
                projectId,
                repositoryKeys: (next?.repositories ?? []).map((repository) =>
                  repositoryKey({
                    installationId: repository.installationId,
                    githubRepoId: repository.githubRepoId,
                  }),
                ),
                ...(next?.defaultHostId ? { hostId: next.defaultHostId } : {}),
              });
            }}
          />
        </Field>
        <Field>
          <FieldLabel>{t('automations.editor.repositories')}</FieldLabel>
          <FieldSelect
            multiple
            aria-label={t('automations.editor.repositories')}
            searchPlaceholder={t('automations.editor.searchRepositories')}
            placeholder={t('automations.editor.chooseRepositories')}
            emptyText={(query) => t('automations.editor.noMatch', { query })}
            value={draft.repositoryKeys}
            options={repositoryOptions}
            onValueChange={(repositoryKeys) => {
              // One is required: the last cannot be unpicked.
              if (repositoryKeys.length) onChange({ repositoryKeys });
            }}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3">
        <span className="eyebrow">{t('automations.editor.runsOn')}</span>
        <Field>
          <FieldLabel>{t('automations.editor.host')}</FieldLabel>
          <FieldSelect
            aria-label={t('automations.editor.host')}
            placeholder={t('automations.editor.chooseHost')}
            searchPlaceholder={t('automations.editor.searchHosts')}
            emptyText={(query) => t('automations.editor.noMatch', { query })}
            value={draft.hostId}
            options={hosts.map((host) => ({
              value: host.id,
              label: host.name,
              description: host.summary,
            }))}
            onValueChange={(hostId) => onChange({ hostId })}
          />
        </Field>
        <Field>
          <FieldLabel>{t('automations.editor.agent')}</FieldLabel>
          <FieldSelect
            aria-label={t('automations.editor.agent')}
            searchPlaceholder={t('automations.editor.searchAgents')}
            placeholder={t('automations.editor.chooseAgent')}
            emptyText={(query) => t('automations.editor.noMatch', { query })}
            value={draft.agent}
            options={AUTOMATION_AGENTS.map((agent) => ({
              value: agent,
              label: CODING_AGENTS[agent].label,
            }))}
            onValueChange={(agent) =>
              onChange({
                agent: agent as CodingAgentId,
                ...(agent !== draft.agent ? { model: null } : {}),
              })
            }
          />
        </Field>
        <Field>
          <FieldLabel>{t('automations.editor.model')}</FieldLabel>
          <FieldSelect
            aria-label={t('automations.editor.model')}
            searchPlaceholder={t('automations.editor.searchModels')}
            placeholder={t('automations.editor.chooseModel')}
            emptyText={(query) => t('automations.editor.noMatch', { query })}
            value={draft.model ?? DEFAULT_MODEL}
            options={[
              { value: DEFAULT_MODEL, label: t('automations.editor.agentDefault') },
              ...models.map((model) => ({ value: model.id, label: model.label })),
            ]}
            onValueChange={(model) => onChange({ model: model === DEFAULT_MODEL ? null : model })}
          />
        </Field>
      </div>
      <FieldDescription>{t('automations.editor.branchHint')}</FieldDescription>
    </div>
  );
}
