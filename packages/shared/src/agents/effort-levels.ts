import type { CodingAgentEffort, SessionEffort } from './catalog.js';

/** A model's levels and default, frozen as the rest of the catalog is. */
export function levels(
  ids: readonly SessionEffort[],
  defaultLevel: SessionEffort,
): CodingAgentEffort {
  return Object.freeze({ levels: Object.freeze([...ids]), default: defaultLevel });
}

export const CLAUDE_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export const CODEX_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
