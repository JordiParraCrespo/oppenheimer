import type { RepositoryScope } from '@oppenheimer/design-system-web';
import {
  CODING_AGENTS,
  type CodingAgentId,
  isCodingAgentId,
  SESSION_PERMISSIONS,
  type SessionPermission,
} from '@oppenheimer/shared/agents';
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
   * new worktree of a project's repository, or a folder already on the host.
   */
  where: SessionPlace;
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
  'where' | 'projectId' | 'hostId' | 'scope' | 'agent' | 'model' | 'permission' | 'efforts'
>;

/** The fields `rememberDraft` writes out, for the form's subscription to name. */
export const REMEMBERED_FIELDS = [
  'where',
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
  const stored = remembered();
  // A model belongs to one agent, so an address naming another agent takes its default.
  const engine =
    seed.agent && seed.agent !== stored.agent
      ? { agent: seed.agent, model: defaultModelFor(seed.agent) }
      : {
          agent: stored.agent ?? FALLBACK.agent,
          model: stored.model ?? (stored.agent ? defaultModelFor(stored.agent) : FALLBACK.model),
        };
  const hostId = seed.hostId ?? stored.hostId ?? FALLBACK.hostId;
  return {
    ...FALLBACK,
    where: seed.where ?? stored.where ?? FALLBACK.where,
    projectId: stored.projectId ?? FALLBACK.projectId,
    hostId,
    scope: stored.scope ?? FALLBACK.scope,
    folder: seedFolder(seed.path, hostId),
    ...engine,
    permission: stored.permission ?? FALLBACK.permission,
    efforts: stored.efforts ?? FALLBACK.efforts,
  };
}

/** An absolute path is the folder; one under `~` waits for the host's home; none takes the host's last. */
function seedFolder(path: string | undefined, hostId: string | null): string | null {
  if (path?.startsWith('/')) return path;
  if (path) return null;
  return hostId ? (rememberedFolder(hostId)?.path ?? null) : null;
}

export function rememberDraft({
  where,
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
      JSON.stringify({ where, projectId, hostId, scope, agent, model, permission, efforts }),
    );
  } catch {
    // Private browsing, a full quota, storage switched off. The screen works
    // exactly as well without the memory.
  }
}

function remembered(): Partial<RememberedChoices> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const stored = JSON.parse(raw) as Partial<RememberedChoices>;
    const agent = isCodingAgentId(stored.agent) ? stored.agent : undefined;
    return {
      where: SESSION_PLACES.find((place) => place === stored.where),
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

/**
 * The project defaults the landing project may still apply: those for a chip
 * the last visit left nothing in. On arrival the memory outranks the project,
 * so the screen opens on what was picked last; a project picked on the screen,
 * or named by the address, applies all of its defaults.
 */
export function unrememberedDefaults<
  T extends Partial<Pick<NewSessionDraft, 'hostId' | 'scope' | 'agent' | 'model'>>,
>(defaults: T): Partial<T> {
  const stored = remembered();
  const patch: Partial<T> = { ...defaults };
  if (stored.hostId) delete patch.hostId;
  if (stored.scope?.length) delete patch.scope;
  if (stored.agent) {
    delete patch.agent;
    delete patch.model;
  }
  return patch;
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
