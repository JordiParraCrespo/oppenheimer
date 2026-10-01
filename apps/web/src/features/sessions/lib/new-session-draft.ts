import type { RepositoryScope } from '@oppenheimer/design-system-web';
import {
  CODING_AGENTS,
  type CodingAgentId,
  isCodingAgentId,
  type SessionPermission,
} from '@oppenheimer/shared/agents';
import { defaultModelFor, type EffortPicks } from './session-options';

/**
 * What New session has been set to and remembers between visits, except that
 * **the permission level is never remembered**: every visit opens on `full`
 * (Full access, Claude Code's `bypassPermissions`), the level sessions here
 * are meant to run at, and a visit that picked a narrower one does not carry
 * it into the next. Nothing here is
 * validated against the lists; the chips do that once their queries answer,
 * when "that host is gone" is a fact rather than a list not yet loaded.
 */
const STORAGE_KEY = 'oppenheimer.new-session.draft';

export interface NewSessionDraft {
  /** The body of work the session belongs to; picking one prefills the rest. */
  projectId: string | null;
  hostId: string | null;
  /** Repository row ids and the branch each is checked out from. */
  scope: RepositoryScope[];
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
  projectId: null,
  hostId: null,
  scope: [],
  agent: 'claude-code',
  model: defaultModelFor('claude-code'),
  permission: 'full',
  efforts: {},
};

/** What is worth carrying between visits: the project, the host and the engine, never the scope. */
type RememberedChoices = Pick<
  NewSessionDraft,
  'projectId' | 'hostId' | 'agent' | 'model' | 'efforts'
>;

/**
 * The draft a visit opens with: the fallback, overlaid with what the last
 * visit remembered.
 *
 * `permission` and `scope` are never restored: the first for the reason on
 * `STORAGE_KEY`, the second because it names repositories this visit may not
 * be about.
 */
export function initialDraft(): NewSessionDraft {
  const stored = remembered();
  return {
    ...FALLBACK,
    projectId: stored.projectId ?? FALLBACK.projectId,
    hostId: stored.hostId ?? FALLBACK.hostId,
    agent: stored.agent ?? FALLBACK.agent,
    model: stored.model ?? (stored.agent ? defaultModelFor(stored.agent) : FALLBACK.model),
    efforts: stored.efforts ?? FALLBACK.efforts,
  };
}

export function rememberDraft({ projectId, hostId, agent, model, efforts }: RememberedChoices) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ projectId, hostId, agent, model, efforts }),
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
      projectId: typeof stored.projectId === 'string' ? stored.projectId : undefined,
      hostId: typeof stored.hostId === 'string' ? stored.hostId : undefined,
      agent,
      // A model is only meaningful for the agent it belongs to.
      model:
        agent && CODING_AGENTS[agent].models.some((model) => model.id === stored.model)
          ? stored.model
          : undefined,
      efforts: effortPicks(stored.efforts),
    };
  } catch {
    // Storage can be unavailable or hold something from an older shape. A draft
    // is a convenience; failing to read one is not worth an error on screen.
    return {};
  }
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
