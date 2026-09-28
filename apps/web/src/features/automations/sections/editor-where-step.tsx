import {
  FieldDescription,
  FieldSelect,
  FieldSelectGroup,
  FieldSelectRow,
} from '@oppenheimer/design-system-web';
import { Bot, Boxes, Cpu, GitBranch, Layers } from '@oppenheimer/design-system-web/icons';
import { repositoryKey, shortName } from '@oppenheimer/frontend-consumer';
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
 * repositories), then Runs on (the host, the agent, its model), each a
 * hairline card of rows with the pick on the right. A run clones
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
    // Named without its owner, as the project entity names it; the list keeps
    // the full name under it.
    label: shortName(repository.fullName),
    description: repository.fullName,
  }));
  const models = CODING_AGENTS[draft.agent].models;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">{t('automations.editor.code')}</span>
        <FieldSelectGroup>
          <FieldSelectRow icon={<Boxes />} label={t('automations.editor.project')}>
            <FieldSelect
              variant="quiet"
              aria-label={t('automations.editor.project')}
              placeholder={t('automations.editor.chooseProject')}
              searchPlaceholder={t('automations.editor.searchProjects')}
              value={draft.projectId}
              meta={
                project
                  ? t('automations.editor.repoCount', { count: project.repositories.length })
                  : undefined
              }
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
          </FieldSelectRow>
          <FieldSelectRow icon={<GitBranch />} label={t('automations.editor.repositories')}>
            <FieldSelect
              variant="quiet"
              multiple
              aria-label={t('automations.editor.repositories')}
              searchPlaceholder={t('automations.editor.searchRepositories')}
              value={draft.repositoryKeys}
              options={repositoryOptions}
              onValueChange={(repositoryKeys) => {
                // One is required: the last cannot be unpicked.
                if (repositoryKeys.length) onChange({ repositoryKeys });
              }}
            />
          </FieldSelectRow>
        </FieldSelectGroup>
      </div>

      <div className="flex flex-col gap-2">
        <span className="eyebrow">{t('automations.editor.runsOn')}</span>
        <FieldSelectGroup>
          <FieldSelectRow icon={<Cpu />} label={t('automations.editor.host')}>
            <FieldSelect
              variant="quiet"
              aria-label={t('automations.editor.host')}
              placeholder={t('automations.editor.chooseHost')}
              searchPlaceholder={t('automations.editor.searchHosts')}
              value={draft.hostId}
              options={hosts.map((host) => ({
                value: host.id,
                label: host.name,
                description: host.summary,
              }))}
              onValueChange={(hostId) => onChange({ hostId })}
            />
          </FieldSelectRow>
          <FieldSelectRow icon={<Bot />} label={t('automations.editor.agent')}>
            <FieldSelect
              variant="quiet"
              aria-label={t('automations.editor.agent')}
              searchPlaceholder={t('automations.editor.searchAgents')}
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
          </FieldSelectRow>
          <FieldSelectRow icon={<Layers />} label={t('automations.editor.model')}>
            <FieldSelect
              variant="quiet"
              aria-label={t('automations.editor.model')}
              searchPlaceholder={t('automations.editor.searchModels')}
              value={draft.model ?? DEFAULT_MODEL}
              options={[
                { value: DEFAULT_MODEL, label: t('automations.editor.agentDefault') },
                ...models.map((model) => ({ value: model.id, label: model.label })),
              ]}
              onValueChange={(model) => onChange({ model: model === DEFAULT_MODEL ? null : model })}
            />
          </FieldSelectRow>
        </FieldSelectGroup>
      </div>
      <FieldDescription>{t('automations.editor.branchHint')}</FieldDescription>
    </div>
  );
}
