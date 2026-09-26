import type { RepositoryScope } from '@oppenheimer/design-system-web';
import {
  CODING_AGENTS,
  type CodingAgentId,
  isCodingAgentId,
  type SessionEffort,
  type SessionPermission,
} from '@oppenheimer/shared/agents';
import { useEffect, useState } from 'react';
import { defaultModelFor } from '../lib/session-options';

/**
 * What New session has been set to, and what it remembers between visits.
 *
 * The artboard says the chips remember the last choice, with one exception this
 * hook enforces: **`full` is never remembered**. Every other control can be
 * restored from storage without consequence; a permission level that escalated
 * itself because it was used once is the failure `product/04-security-review.md`
 * exists to prevent, so a stored `full` reads back as `ask`.
 *
 * Nothing here is validated against the lists — the section does that once its
 * queries answer, because only then is "that host is gone" a fact rather than a
 * list that has not loaded yet.
 */
const STORAGE_KEY = 'oppenheimer.new-session.draft';

export interface NewSessionDraft {
  /** The project the session is listed under. Every session names one. */
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
interface RememberedChoices {
  projectId: string | null;
  hostId: string | null;
  agent: CodingAgentId;
  model: string | null;
  effort: SessionEffort;
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

export function useNewSessionDraft() {
  const [draft, setDraft] = useState<NewSessionDraft>(() => {
    const stored = remembered();
    return {
      ...FALLBACK,
      projectId: stored.projectId ?? FALLBACK.projectId,
      hostId: stored.hostId ?? FALLBACK.hostId,
      agent: stored.agent ?? FALLBACK.agent,
      model: stored.model ?? (stored.agent ? defaultModelFor(stored.agent) : FALLBACK.model),
      effort: stored.effort ?? FALLBACK.effort,
      // `permission` and `scope` are deliberately absent: the first must never
      // be restored at a level that escalates, and the second names
      // repositories this visit may not be about.
    };
  });

  /**
   * Write the remembered choices out.
   *
   * The external system is `localStorage`, which is what makes this an effect
   * rather than something the setter does: a state updater must be pure, and
   * writing from inside one ran twice per change under StrictMode. It syncs on
   * the five fields that are remembered, so a repository or a permission level
   * never triggers it.
   */
  const { projectId, hostId, agent, model, effort } = draft;
  useEffect(() => {
    remember({ projectId, hostId, agent, model, effort });
  }, [projectId, hostId, agent, model, effort]);

  /** Apply a change. What of it survives the visit is the effect above. */
  function update(patch: Partial<NewSessionDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  /** Switching agent carries the model with it: a model belongs to one agent. */
  function setEngine(agent: CodingAgentId, model: string | null) {
    update({ agent, model: model ?? defaultModelFor(agent) });
  }

  return { draft, update, setEngine };
}

/** The five choices worth carrying between visits, as storage holds them. */
function remember(choices: RememberedChoices) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
  } catch {
    // Private browsing, a full quota, storage switched off. The screen works
    // exactly as well without the memory.
  }
}
