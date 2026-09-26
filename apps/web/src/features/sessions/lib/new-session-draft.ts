import type { RepositoryScope } from '@oppenheimer/design-system-web';
import {
  CODING_AGENTS,
  type CodingAgentId,
  isCodingAgentId,
  type SessionEffort,
  type SessionPermission,
} from '@oppenheimer/shared/agents';
import { defaultModelFor } from './session-options';

/**
 * What New session has been set to, and what it remembers between visits.
 *
 * The artboard says the chips remember the last choice — the project among
 * them, since 12 — with one exception enforced here: **`full` is never
 * remembered**. Every other control can be restored from storage without
 * consequence; a permission level that escalated itself because it was used
 * once is the failure `product/04-security-review.md` exists to prevent, so a
 * stored `full` is never read back.
 *
 * Nothing here is validated against the lists — the chips do that once their
 * queries answer, because only then is "that host is gone" a fact rather than a
 * list that has not loaded yet.
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
  effort: SessionEffort;
}

const FALLBACK: NewSessionDraft = {
  projectId: null,
  hostId: null,
  scope: [],
  agent: 'claude-code',
  model: defaultModelFor('claude-code'),
  permission: 'ask',
  effort: 'medium',
};

/** What is worth carrying between visits: the project and the engine, never the scope. */
type RememberedChoices = Pick<
  NewSessionDraft,
  'projectId' | 'hostId' | 'agent' | 'model' | 'effort'
>;

/**
 * The draft a visit opens with: the fallback, overlaid with what the last
 * visit remembered.
 *
 * `permission` and `scope` are deliberately never restored: the first must
 * never come back at a level that escalates, and the second names
 * repositories this visit may not be about.
 */
export function initialDraft(): NewSessionDraft {
  const stored = remembered();
  return {
    ...FALLBACK,
    projectId: stored.projectId ?? FALLBACK.projectId,
    hostId: stored.hostId ?? FALLBACK.hostId,
    agent: stored.agent ?? FALLBACK.agent,
    model: stored.model ?? (stored.agent ? defaultModelFor(stored.agent) : FALLBACK.model),
    effort: stored.effort ?? FALLBACK.effort,
  };
}

/** Write the five choices worth carrying between visits out to storage. */
export function rememberDraft({ projectId, hostId, agent, model, effort }: RememberedChoices) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ projectId, hostId, agent, model, effort }),
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
      effort: typeof stored.effort === 'string' ? (stored.effort as SessionEffort) : undefined,
    };
  } catch {
    // Storage can be unavailable or hold something from an older shape. A draft
    // is a convenience; failing to read one is not worth an error on screen.
    return {};
  }
}
