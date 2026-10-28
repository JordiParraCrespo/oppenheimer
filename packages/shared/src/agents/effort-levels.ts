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
/**
 * Grok's reasoning menus, one fact wherever a Grok model is reached: grok
 * 1.0.70's built-in models, xAI's reasoning guide for the Responses API and
 * OpenCode's `xai/` variants all give 4.7 and 4.6 low to extra high, and 4.5
 * low to high.
 */
export const GROK_LEVELS = ['low', 'medium', 'high', 'xhigh'] as const;
export const GROK_4_5_LEVELS = ['low', 'medium', 'high'] as const;
