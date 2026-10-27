import type { RepositoryScope } from '@oppenheimer/design-system-web';
import {
  CODING_AGENTS,
  type CodingAgentId,
  isCodingAgentId,
  SESSION_PERMISSIONS,
  type SessionPermission,
} from '@oppenheimer/shared/agents';
import {
  CLOUD_AGENT_PROVIDERS,
  type CloudAgentProviderId,
} from '@oppenheimer/shared/schemas/cloud-agent';
import { SESSION_PLACES, type SessionPlace } from '@oppenheimer/shared/schemas/session';
import { rememberedFolder } from './folder-memory';
import { defaultModelFor, type EffortPicks } from './session-options';

/**
 * What New session has been set to and remembers between visits, every chip
 * included: the permission level opens on `auto` (Claude Code's own default for
 * a session nobody watches line by line) and then on the last level picked, and
 * the repository and branch open on the last ones picked.
 * Nothing here is validated against the lists; the chips do that once their queries answer,
 * when "that host is gone" is a fact rather than a list not yet loaded.
 */
const STORAGE_KEY = 'oppenheimer.new-session.draft';

export interface NewSessionDraft {
  /**
   * Where the session runs (`product/versions/mvp/24-session-places.md`): a
   * new worktree of a project's repository, a folder already on the host, or
   * a vendor's cloud. In the cloud the host, folder, agent and model below are
   * kept as they were, so leaving it puts back the host session it left.
   */
  where: SessionPlace;
  /** The vendor a cloud session runs on: whose agent, on the reader's key. */
  cloudProvider: CloudAgentProviderId;
  /** The vendor's model; null is its own default ("Auto"). */
  cloudModel: string | null;
  /** The body of work the session belongs to; picking one prefills the rest. */
  projectId: string | null;
  hostId: string | null;
  /** Repository row ids and the branch each is checked out from. */
  scope: RepositoryScope[];
  /**
   * A folder session's folder, absolute on the host. Remembered per host
   * (`folder-memory.ts`), so switching host switches it to that host's last.
   */
  folder: string | null;
  agent: CodingAgentId;
  model: string | null;
  permission: SessionPermission;
  /**
   * The effort picked for each agent, under that CLI's own level names. Empty
   * until somebody moves the slider: the knob then sits on the model's default
   * and nothing is sent (`effortChoiceFor`).
   */
  efforts: EffortPicks;
}

const FALLBACK: NewSessionDraft = {
  where: 'worktree',
  cloudProvider: 'cursor',
  cloudModel: null,
  projectId: null,
  hostId: null,
  scope: [],
  folder: null,
  agent: 'claude-code',
  model: defaultModelFor('claude-code'),
  permission: 'auto',
  efforts: {},
};

/**
 * What is carried between visits: every chip's last choice. The folder is
 * remembered per host, on its own (`folder-memory.ts`).
 */
type RememberedChoices = Pick<
  NewSessionDraft,
  | 'where'
  | 'cloudProvider'
  | 'cloudModel'
  | 'projectId'
  | 'hostId'
  | 'scope'
  | 'agent'
  | 'model'
  | 'permission'
  | 'efforts'
>;

/** The fields `rememberDraft` writes out, for the form's subscription to name. */
export const REMEMBERED_FIELDS = [
  'where',
  'cloudProvider',
  'cloudModel',
  'projectId',
  'hostId',
  'scope',
  'agent',
  'model',
  'permission',
  'efforts',
] as const satisfies readonly (keyof RememberedChoices)[];

/**
 * What an address asks the draft to open on, over what was remembered: Settings'
 * **Open terminal** names a folder session on a host, in its home, with the
 * blank terminal (`new-session-search.ts`). A path under `~` cannot be the
 * draft's folder until the host says where its home is, so it opens with none
 * and the folder chip resolves it.
 */
export interface DraftSeed {
  where?: SessionPlace;
  hostId?: string;
  agent?: CodingAgentId;
  /** Absolute, or under `~`. */
  path?: string;
}

/**
 * The draft a visit opens with: the fallback, overlaid with what the last
 * visit remembered, overlaid with what the address asks for.
 */
export function initialDraft(seed: DraftSeed = {}): NewSessionDraft {
  return openDraft(seed).draft;
}

/**
 * The draft a visit opens with and the chips its landing project may still
 * fill, both from one read of the memory, taken before the visit writes to it.
 */
export function openDraft(seed: DraftSeed = {}): {
  draft: NewSessionDraft;
  fillable: readonly ProjectFilled[];
} {
  const stored = rememberedChoices();
  // A model belongs to one agent, so an address naming another agent takes its default.
  const engine =
    seed.agent && seed.agent !== stored.agent
      ? { agent: seed.agent, model: defaultModelFor(seed.agent) }
      : {
          agent: stored.agent ?? FALLBACK.agent,
          model: stored.model ?? (stored.agent ? defaultModelFor(stored.agent) : FALLBACK.model),
        };
  const hostId = seed.hostId ?? stored.hostId ?? FALLBACK.hostId;
  const draft: NewSessionDraft = {
    ...FALLBACK,
    where: seed.where ?? stored.where ?? FALLBACK.where,
    cloudProvider: stored.cloudProvider ?? FALLBACK.cloudProvider,
    cloudModel: stored.cloudModel ?? FALLBACK.cloudModel,
    projectId: stored.projectId ?? FALLBACK.projectId,
    hostId,
    scope: stored.scope ?? FALLBACK.scope,
    folder: seedFolder(seed.path, hostId),
    ...engine,
    permission: stored.permission ?? FALLBACK.permission,
    efforts: stored.efforts ?? FALLBACK.efforts,
  };
  return { draft, fillable: landingFillable(stored) };
}

/** An absolute path is the folder; one under `~` waits for the host's home; none takes the host's last. */
function seedFolder(path: string | undefined, hostId: string | null): string | null {
  if (path?.startsWith('/')) return path;
  if (path) return null;
  return hostId ? (rememberedFolder(hostId)?.path ?? null) : null;
}

export function rememberDraft({
  where,
  cloudProvider,
  cloudModel,
  projectId,
  hostId,
  scope,
  agent,
  model,
  permission,
  efforts,
}: RememberedChoices) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        where,
        cloudProvider,
        cloudModel,
        projectId,
        hostId,
        scope,
        agent,
        model,
        permission,
        efforts,
      }),
    );
  } catch {
    // Private browsing, a full quota, storage switched off. The screen works
    // exactly as well without the memory.
  }
}

/** What the last visit left in storage, each field checked against the catalog. */
function rememberedChoices(): Partial<RememberedChoices> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const stored = JSON.parse(raw) as Partial<RememberedChoices>;
    const agent = isCodingAgentId(stored.agent) ? stored.agent : undefined;
    return {
      where: SESSION_PLACES.find((place) => place === stored.where),
      cloudProvider: CLOUD_AGENT_PROVIDERS.find((provider) => provider === stored.cloudProvider),
      // A vendor's model list moves with its releases: kept as it was, and the
      // vendor refuses one it no longer offers in its own words.
      cloudModel: typeof stored.cloudModel === 'string' ? stored.cloudModel : undefined,
      projectId: typeof stored.projectId === 'string' ? stored.projectId : undefined,
      hostId: typeof stored.hostId === 'string' ? stored.hostId : undefined,
      scope: scopePicks(stored.scope),
      agent,
      // A model is only meaningful for the agent it belongs to.
      model:
        agent && CODING_AGENTS[agent].models.some((model) => model.id === stored.model)
          ? stored.model
          : undefined,
      permission: SESSION_PERMISSIONS.find((level) => level === stored.permission),
      efforts: effortPicks(stored.efforts),
    };
  } catch {
    // Storage can be unavailable or hold something from an older shape. A draft
    // is a convenience; failing to read one is not worth an error on screen.
    return {};
  }
}

/** The chips a project's defaults fill. */
export const PROJECT_FILLED = ['hostId', 'scope', 'agent', 'model'] as const;
export type ProjectFilled = (typeof PROJECT_FILLED)[number];

/**
 * The chips the landing project may still fill: those the last visit left
 * nothing in. On arrival the memory outranks the project, so the screen opens
 * on what was picked last; a project picked on the screen, or named by the
 * address, fills them all. A model belongs to its agent, so it goes with it.
 */
function landingFillable(stored: Partial<RememberedChoices>): readonly ProjectFilled[] {
  const remembers: Record<ProjectFilled, boolean> = {
    hostId: Boolean(stored.hostId),
    scope: Boolean(stored.scope?.length),
    agent: Boolean(stored.agent),
    model: Boolean(stored.agent),
  };
  return PROJECT_FILLED.filter((field) => !remembers[field]);
}

/** A project's defaults, kept to the chips named. */
export function onlyFields<T extends Partial<Record<ProjectFilled, unknown>>>(
  defaults: T,
  fields: readonly ProjectFilled[],
): Partial<T> {
  return Object.fromEntries(
    Object.entries(defaults).filter(([field]) => fields.includes(field as ProjectFilled)),
  ) as Partial<T>;
}

/** The repositories and branches a stored draft holds, each a row id and a branch. */
function scopePicks(stored: unknown): RepositoryScope[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return stored
    .filter(
      (entry): entry is RepositoryScope =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.id === 'string' &&
        typeof entry.branch === 'string',
    )
    .map(({ id, branch }) => ({ id, branch }));
}

/**
 * The per-agent picks a stored draft holds, as they were left: a string for an
 * agent this build knows. Whether a pick is one of the model's levels is decided
 * when the slider is drawn (`effortChoiceFor`), not here. A draft saved before
 * effort was per agent held one `effort` for all of them; it is not read back,
 * because the same word now names a different level for Claude Code.
 */
function effortPicks(stored: unknown): EffortPicks | undefined {
  if (typeof stored !== 'object' || stored === null) return undefined;
  const picks: EffortPicks = {};
  for (const [agent, level] of Object.entries(stored)) {
    if (isCodingAgentId(agent) && typeof level === 'string') picks[agent] = level;
  }
  return picks;
}
