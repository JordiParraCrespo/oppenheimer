import type { CodingAgentModel } from './catalog.js';
import { CODEX_LEVELS, levels } from './effort-levels.js';

const CODEX_ULTRA_LEVELS = [...CODEX_LEVELS, 'ultra'] as const;

/**
 * Codex's `models` entry in `CODING_AGENTS`, kept beside the catalog because
 * it grows with every OpenAI generation, and OpenCode's `openai/` rows are
 * read off it.
 *
 * What codex's own picker lists, in its order, with the slugs `codex --model`
 * takes and each model's levels and default as codex reports them; a seed,
 * with the limit Claude Code's has: nothing probes which a host's CLI knows.
 */
export const CODEX_MODELS: readonly CodingAgentModel[] = Object.freeze([
  Object.freeze({
    id: 'gpt-6.2-sol',
    label: 'GPT-6.2 Sol',
    default: true as const,
    effort: levels(CODEX_ULTRA_LEVELS, 'low'),
  }),
  Object.freeze({
    id: 'gpt-6.2-astra',
    label: 'GPT-6.2 Astra',
    effort: levels(CODEX_ULTRA_LEVELS, 'low'),
  }),
  Object.freeze({
    id: 'gpt-6.1-sol',
    label: 'GPT-6.1 Sol',
    effort: levels(CODEX_ULTRA_LEVELS, 'low'),
  }),
  Object.freeze({
    id: 'gpt-6.1-terra',
    label: 'GPT-6.1 Terra',
    effort: levels(CODEX_ULTRA_LEVELS, 'medium'),
  }),
  Object.freeze({
    id: 'gpt-6-astra',
    label: 'GPT-6 Astra',
    effort: levels(CODEX_ULTRA_LEVELS, 'low'),
  }),
  Object.freeze({
    id: 'gpt-6-sol',
    label: 'GPT-6 Sol',
    effort: levels(CODEX_ULTRA_LEVELS, 'medium'),
  }),
  Object.freeze({
    id: 'gpt-6-luna',
    label: 'GPT-6 Luna',
    effort: levels(CODEX_LEVELS, 'medium'),
  }),
  Object.freeze({
    id: 'gpt-5.6-sol',
    label: 'GPT-5.6 Sol',
    effort: levels(CODEX_ULTRA_LEVELS, 'low'),
  }),
  Object.freeze({
    id: 'gpt-5.6-terra',
    label: 'GPT-5.6 Terra',
    effort: levels(CODEX_ULTRA_LEVELS, 'medium'),
  }),
  Object.freeze({
    id: 'gpt-5.6-luna',
    label: 'GPT-5.6 Luna',
    effort: levels(CODEX_LEVELS, 'medium'),
  }),
]);
