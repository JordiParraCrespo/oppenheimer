import type { CodingAgentEffort, SessionEffort } from './catalog.js';

/** A model's levels and default, frozen as the rest of the catalog is. */
export function levels(
  ids: readonly SessionEffort[],
  defaultLevel: SessionEffort,
): CodingAgentEffort {
  return Object.freeze({ levels: Object.freeze([...ids]), default: defaultLevel });
}

export const CLAUDE_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
/** Opus 4.6 and Sonnet 4.6: Claude's levels before `xhigh`, which arrived with Opus 4.7. */
export const CLAUDE_4_6_LEVELS = ['low', 'medium', 'high', 'max'] as const;
export const CODEX_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
/**
 * Grok's reasoning menus, one fact wherever a Grok model is reached: grok
 * 1.0.70's built-in models, xAI's reasoning guide for the Responses API and
 * OpenCode's `xai/` variants all give 4.7 and 4.6 low to extra high, and 4.5
 * low to high.
 */
export const GROK_LEVELS = ['low', 'medium', 'high', 'xhigh'] as const;
export const GROK_4_5_LEVELS = ['low', 'medium', 'high'] as const;
/**
 * Antigravity's thinking levels for the Gemini 4 models: Low, Medium (its
 * default), High and Extra, which `agy --effort` spells `xhigh` (Google's
 * models page for the CLI, and `invalid --effort %q` in agy 1.5.15).
 */
export const GEMINI_4_LEVELS = ['low', 'medium', 'high', 'xhigh'] as const;
/** Gemini 3.8 Flash's three, which agy 1.5.15 names `gemini-3.8-flash-low` to `-high`. */
export const GEMINI_FLASH_LEVELS = ['low', 'medium', 'high'] as const;
