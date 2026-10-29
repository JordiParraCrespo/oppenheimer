import {
  FieldDescription,
  FieldSelect,
  FieldSelectGroup,
  FieldSelectRow,
} from '@oppenheimer/design-system-web';
import { Bot, Boxes, Cloud, Cpu, GitBranch, Layers } from '@oppenheimer/design-system-web/icons';
import { repositoryKey, shortName } from '@oppenheimer/frontend-consumer';
import {
  useCloudAgentModels,
  useCloudAgentStatus,
  useHosts,
  useProjects,
} from '@oppenheimer/frontend-consumer/react';
import { CODING_AGENTS, type CodingAgentId } from '@oppenheimer/shared/agents';
import {
  AUTOMATION_PLACES,
  type AutomationPlace,
  isVendorPlace,
} from '@oppenheimer/shared/automations';
import { useTranslation } from 'react-i18next';
import {
  AUTOMATION_AGENTS,
  type AutomationDraft,
  isAutomationAgent,
  placePatch,
} from '../lib/automation-draft';

const DEFAULT_MODEL = '__default__';

type WherePatch = Partial<
  Pick<AutomationDraft, 'projectId' | 'repositoryKeys' | 'place' | 'hostId' | 'agent' | 'model'>
>;

function isAutomationPlace(value: string): value is AutomationPlace {
  return (AUTOMATION_PLACES as readonly string[]).includes(value);
}

/**
 * The editor's Where it runs step: Code (the project and which of its
 * repositories), then Runs on (where — a host, Claude Code's cloud from a
 * host, or Cursor's cloud with no host — then the host, the agent and its
 * model, as far as that place has them), each a hairline card of rows with
 * the pick on the right. Cursor is offered once the reader has a key for it. A run clones only from
 * the project, so the repositories offered are the project's; a new project
 * picks all of them.
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
  const vendor = isVendorPlace(draft.place);
  const { data: cloudStatus } = useCloudAgentStatus();
  const cursorConnected =
    cloudStatus?.providers.some((row) => row.id === 'cursor' && row.connected) ?? false;
  const { data: cursorModels = [] } = useCloudAgentModels('cursor', vendor && cursorConnected);
  const models = vendor
    ? cursorModels
    : isAutomationAgent(draft.agent)
      ? CODING_AGENTS[draft.agent].models
      : [];

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
              emptyText={(query) => t('automations.editor.noMatch', { query })}
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
              placeholder={t('automations.editor.chooseRepositories')}
              emptyText={(query) => t('automations.editor.noMatch', { query })}
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
          <FieldSelectRow icon={<Cloud />} label={t('automations.editor.runsIn')}>
            <FieldSelect
              variant="quiet"
              aria-label={t('automations.editor.runsIn')}
              placeholder={t('automations.editor.placeHost')}
              searchPlaceholder={t('automations.editor.runsIn')}
              emptyText={(query) => t('automations.editor.noMatch', { query })}
              value={draft.place}
              options={[
                {
                  value: 'host',
                  label: t('automations.editor.placeHost'),
                  description: t('automations.editor.placeHostDesc'),
                },
                {
                  value: 'claude-cloud',
                  label: t('automations.editor.placeClaudeCloud'),
                  description: t('automations.editor.placeClaudeCloudDesc'),
                },
                {
                  value: 'cursor',
                  label: t('automations.editor.placeCursor'),
                  // Picking it with no key would save an automation that pauses on its first run.
                  disabled: !cursorConnected && draft.place !== 'cursor',
                  description: cursorConnected
                    ? t('automations.editor.placeCursorDesc')
                    : t('automations.editor.placeCursorConnect'),
                },
              ]}
              onValueChange={(place) => {
                if (!isAutomationPlace(place)) return;
                onChange(placePatch(draft, place, project?.defaultHostId ?? hosts[0]?.id ?? null));
              }}
            />
          </FieldSelectRow>
          {vendor ? null : (
            <FieldSelectRow
              icon={<Cpu />}
              label={
                draft.place === 'claude-cloud'
                  ? t('automations.editor.startedFrom')
                  : t('automations.editor.host')
              }
            >
              <FieldSelect
                variant="quiet"
                aria-label={t('automations.editor.host')}
                placeholder={t('automations.editor.chooseHost')}
                searchPlaceholder={t('automations.editor.searchHosts')}
                emptyText={(query) => t('automations.editor.noMatch', { query })}
                value={draft.hostId}
                options={hosts.map((host) => ({
                  value: host.id,
                  label: host.name,
                  // In Claude Code's cloud, the account a run goes out on is the host's.
                  description:
                    draft.place === 'claude-cloud'
                      ? (host.details.claudeAccount ?? host.summary)
                      : host.summary,
                }))}
                onValueChange={(hostId) => onChange({ hostId })}
              />
            </FieldSelectRow>
          )}
          {draft.place === 'host' ? (
            <FieldSelectRow icon={<Bot />} label={t('automations.editor.agent')}>
              <FieldSelect
                variant="quiet"
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
            </FieldSelectRow>
          ) : null}
          <FieldSelectRow icon={<Layers />} label={t('automations.editor.model')}>
            <FieldSelect
              variant="quiet"
              aria-label={t('automations.editor.model')}
              searchPlaceholder={t('automations.editor.searchModels')}
              placeholder={t('automations.editor.chooseModel')}
              emptyText={(query) => t('automations.editor.noMatch', { query })}
              value={draft.model ?? DEFAULT_MODEL}
              options={[
                {
                  value: DEFAULT_MODEL,
                  label: vendor
                    ? t('automations.editor.vendorDefault')
                    : t('automations.editor.agentDefault'),
                },
                ...models.map((model) => ({ value: model.id, label: model.label })),
              ]}
              onValueChange={(model) => onChange({ model: model === DEFAULT_MODEL ? null : model })}
            />
          </FieldSelectRow>
        </FieldSelectGroup>
      </div>
      <FieldDescription>
        {draft.place === 'host'
          ? t('automations.editor.branchHint')
          : t('automations.editor.cloudHint')}
      </FieldDescription>
    </div>
  );
}
