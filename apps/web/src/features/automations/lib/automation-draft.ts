import {
  type AutomationEntity,
  type AutomationInput,
  type HostEntity,
  type ProjectEntity,
  parseRepositoryKey,
  repositoryKey,
  type TriggerInput,
  type UpdateAutomationInput,
} from '@oppenheimer/frontend-consumer';
import { CODING_AGENTS, type CodingAgentId } from '@oppenheimer/shared/agents';
import {
  externalEventDefinition,
  type GithubEventType,
  type ScheduleFrequency,
  type TriggerFilter,
} from '@oppenheimer/shared/automations';
import { localDate } from './time';

export type ScheduleCard = Extract<TriggerInput, { source: 'schedule' }> & { key: string };
export type GithubCard = Extract<TriggerInput, { source: 'github' }> & { key: string };
export type TriggerCard = ScheduleCard | GithubCard;

/**
 * The editor's state apart from the two typed fields (name and prompt, which
 * React Hook Form holds): what is picked, not typed. It is saved whole.
 */
export interface AutomationDraft {
  projectId: string | null;
  /** `repositoryKey`s: the installation and GitHub's id, together. */
  repositoryKeys: string[];
  hostId: string | null;
  agent: CodingAgentId;
  /** `null` runs the agent's own default. */
  model: string | null;
  triggers: TriggerCard[];
}

/** The agents an automation can run: every one with a model to drive, not the blank terminal. */
export const AUTOMATION_AGENTS = (Object.keys(CODING_AGENTS) as CodingAgentId[]).filter(
  (agent) => CODING_AGENTS[agent].models.length > 0,
);

let cardSequence = 0;
function nextKey(): string {
  cardSequence += 1;
  return `card-${cardSequence}`;
}

function projectRepositoryKeys(project: ProjectEntity | undefined): string[] {
  return (project?.repositories ?? []).map((repository) =>
    repositoryKey({
      installationId: repository.installationId,
      githubRepoId: repository.githubRepoId,
    }),
  );
}

/** GitHub's ids of the draft's repositories: what a GitHub card listens on. */
export function draftRepoIds(draft: Pick<AutomationDraft, 'repositoryKeys'>): number[] {
  return draft.repositoryKeys.flatMap((key) => {
    const ref = parseRepositoryKey(key);
    return ref ? [Number(ref.githubRepoId)] : [];
  });
}

/**
 * A new automation's defaults: the project it was opened for (or the first
 * named one), all of that project's repositories, its default host and agent.
 */
export function emptyDraft(
  projects: readonly ProjectEntity[],
  hosts: readonly HostEntity[],
  projectId: string | undefined,
): AutomationDraft {
  const named = projects.filter((project) => !project.isUnassigned);
  const project = named.find((candidate) => candidate.id === projectId) ?? named[0];
  const agent =
    project?.defaultAgent && AUTOMATION_AGENTS.includes(project.defaultAgent)
      ? project.defaultAgent
      : 'claude-code';
  return {
    projectId: project?.id ?? null,
    repositoryKeys: projectRepositoryKeys(project),
    hostId: project?.defaultHostId ?? hosts[0]?.id ?? null,
    agent,
    model: null,
    triggers: [],
  };
}

export function draftOf(automation: AutomationEntity): AutomationDraft {
  const { revision } = automation;
  return {
    projectId: automation.projectId,
    repositoryKeys: revision.repositories.map((repository) =>
      repositoryKey({
        installationId: repository.installationId,
        githubRepoId: repository.githubRepoId,
      }),
    ),
    hostId: revision.hostId,
    agent: revision.agent,
    model: revision.model,
    triggers: automation.triggers.map((trigger): TriggerCard => {
      if (trigger.source === 'schedule') {
        const { id: _id, nextFireAt: _next, ...rule } = trigger;
        return { ...rule, key: nextKey() };
      }
      return {
        source: 'github',
        event: trigger.event,
        repositories: trigger.repositories.map(Number),
        filter: trigger.filter,
        key: nextKey(),
      };
    }),
  };
}

/**
 * A schedule card of a frequency, carrying only the fields that frequency
 * reads — the API refuses the others, so a stored rule says exactly what it
 * does. Switching frequency keeps the time.
 */
export function withFrequency(
  card: Pick<ScheduleCard, 'hour' | 'minute' | 'timezone' | 'key'> & Partial<ScheduleCard>,
  frequency: ScheduleFrequency,
  now: number,
): ScheduleCard {
  const base = {
    source: 'schedule' as const,
    frequency,
    hour: card.hour,
    minute: card.minute,
    timezone: card.timezone,
    key: card.key,
  };
  if (frequency === 'weekly') return { ...base, days: card.days?.length ? card.days : [1] };
  if (frequency === 'monthly') return { ...base, dayOfMonth: card.dayOfMonth ?? 1 };
  if (frequency === 'once') {
    return { ...base, date: card.date ?? localDate(now + 86_400_000, card.timezone) };
  }
  return base;
}

/** A new schedule card: 09:00 in the viewer's zone. */
export function scheduleCard(frequency: ScheduleFrequency, now: number, timezone: string) {
  return withFrequency({ hour: 9, minute: 0, timezone, key: nextKey() }, frequency, now);
}

/** The filter a new card of this event starts with ("main" for a pull request's base). */
export function defaultFilter(event: GithubEventType): TriggerFilter {
  return externalEventDefinition('github', event)?.defaultFilter ?? { op: 'any' };
}

export function githubCard(event: GithubEventType, repositories: number[]): GithubCard {
  return {
    source: 'github',
    event,
    repositories,
    filter: defaultFilter(event),
    key: nextKey(),
  };
}

/**
 * Keeps each GitHub card inside the automation's repositories after the set
 * changes: a card loses a repository that left, and a card left with none
 * listens on all of them rather than on nothing.
 */
export function fitCards(triggers: TriggerCard[], repositories: number[]): TriggerCard[] {
  return triggers.map((card) => {
    if (card.source !== 'github') return card;
    const kept = card.repositories.filter((id) => repositories.includes(id));
    return { ...card, repositories: kept.length ? kept : repositories };
  });
}

/** What still blocks each step, or `null` when it is complete. */
export type DraftGap = 'name' | 'prompt' | 'trigger' | 'where' | null;

export function whereGap(draft: AutomationDraft): DraftGap {
  return draft.projectId && draft.repositoryKeys.length && draft.hostId ? null : 'where';
}

function stripKey(card: TriggerCard): TriggerInput {
  const { key: _key, ...trigger } = card;
  return trigger;
}

function repositoriesOf(draft: AutomationDraft): AutomationInput['repositories'] {
  return draft.repositoryKeys.flatMap((key) => {
    const ref = parseRepositoryKey(key);
    return ref
      ? [{ installationId: ref.installationId, githubRepoId: Number(ref.githubRepoId) }]
      : [];
  });
}

export function toCreateInput(
  draft: AutomationDraft,
  task: { name: string; prompt: string },
): AutomationInput | null {
  if (!draft.projectId || !draft.hostId) return null;
  return {
    projectId: draft.projectId,
    repositories: repositoriesOf(draft),
    hostId: draft.hostId,
    name: task.name,
    prompt: task.prompt,
    agent: draft.agent,
    triggers: draft.triggers.map(stripKey),
    ...(draft.model ? { launch: { model: draft.model } } : {}),
  };
}

/**
 * The save request for an edit: the whole draft at the version the editor
 * loaded, so a save over another tab's is refused rather than winning.
 */
export function toUpdateInput(
  draft: AutomationDraft,
  task: { name: string; prompt: string },
  version: number,
): UpdateAutomationInput | null {
  const input = toCreateInput(draft, task);
  if (!input) return null;
  const { launch: _launch, ...rest } = input;
  // The API keeps a model only while one is sent; an edit that picked the
  // default sends none, which clears it.
  return { ...rest, launch: draft.model ? { model: draft.model } : {}, version };
}
