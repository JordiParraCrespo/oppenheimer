import type { CodingAgentModel } from './catalog.js';
import { CLAUDE_LEVELS, CODEX_LEVELS, levels } from './effort-levels.js';

// OpenCode's variants for xAI's and Google's reasoning models, off models.dev;
// OpenAI's are Codex's own levels, so OpenCode's OpenAI rows reuse CODEX_LEVELS,
// and MiniMax M3.1 Flash offers Claude's five, so it reuses CLAUDE_LEVELS.
const OPENCODE_XAI_LEVELS = ['low', 'medium', 'high', 'xhigh'] as const;
const OPENCODE_GOOGLE_LEVELS = ['low', 'medium', 'high'] as const;
// The effort values models.dev lists for GLM 5.3, DeepSeek V4 and Kimi K3.1
// alike, which OpenCode offers as its variants; Qwen 3.8 names its own three.
const OPENCODE_LOW_HIGH_MAX_LEVELS = ['low', 'high', 'max'] as const;
const OPENCODE_QWEN_LEVELS = ['low', 'medium', 'xhigh'] as const;

/**
 * OpenCode's `models` entry in `CODING_AGENTS`, kept beside the catalog
 * because it is the one list that grows with every provider OpenCode reaches.
 *
 * `provider/model`, the form `opencode --model` takes. OpenCode reaches
 * whatever providers the host has signed in to, and its own picker is
 * models.dev's catalog, so this seed is the coding models of the
 * providers it is most often signed in to, grouped by provider in that
 * order: Anthropic (the family Claude Code offers), OpenAI (what Codex's
 * picker lists, in its order), xAI (what Grok's lists), Google (its
 * newest reasoning and flash models), then the open-weight coding models:
 * Z.AI (GLM 5.3 and its fast variants), DeepSeek (V4 Pro and the V4.1
 * Flash), Moonshot (Kimi K3.1 Pro and the K2.7 Code model), Alibaba
 * (Qwen 3.8 Max and Flash) and MiniMax (M3.1 Flash), each under the
 * provider that is the vendor's own international API. A row the host's
 * OpenCode has no provider for fails in the session's own terminal, as
 * for the others.
 *
 * GLM is under `zai-coding-plan/`, OpenCode's provider for z.ai's GLM
 * Coding Plan, the subscription z.ai sells for coding agents and the
 * endpoint a workspace's GLM key already serves bots on. Its key is
 * OpenCode's `/connect` → "Z.AI Coding Plan", or `ZHIPU_API_KEY` in the
 * agent's environment; `zai/` is the pay-as-you-go API, a separate
 * balance the plan's quota does not cover.
 *
 * Each model's levels are its OpenCode variants, which OpenCode derives
 * from the model's `reasoning_options` on models.dev, and its default is
 * what the provider runs with none: `high` for the adaptive Claude
 * models and for Grok and Gemini, `medium` for OpenAI's. Haiku 5.5's
 * thinking is a toggle that is off unasked, so `none` is its default and
 * a level of its own. OpenAI's `none` variant is left off: "don't think"
 * is not an amount of thinking anyone picks for a coding session.
 */
export const OPENCODE_MODELS: readonly CodingAgentModel[] = Object.freeze([
  Object.freeze({
    id: 'anthropic/claude-opus-5-5',
    label: 'Opus 5.5',
    default: true as const,
    effort: levels(CLAUDE_LEVELS, 'high'),
  }),
  Object.freeze({
    id: 'anthropic/claude-fable-5-1',
    label: 'Fable 5.1',
    effort: levels(CLAUDE_LEVELS, 'high'),
  }),
  Object.freeze({
    id: 'anthropic/claude-sonnet-5-5',
    label: 'Sonnet 5.5',
    effort: levels(CLAUDE_LEVELS, 'high'),
  }),
  Object.freeze({
    id: 'anthropic/claude-haiku-5-5',
    label: 'Haiku 5.5',
    effort: levels(['none', ...CLAUDE_LEVELS], 'none'),
  }),
  Object.freeze({
    id: 'openai/gpt-6.1-sol',
    label: 'GPT-6.1 Sol',
    effort: levels(CODEX_LEVELS, 'medium'),
  }),
  Object.freeze({
    id: 'openai/gpt-6.1-terra',
    label: 'GPT-6.1 Terra',
    effort: levels(CODEX_LEVELS, 'medium'),
  }),
  Object.freeze({
    id: 'openai/gpt-6-astra',
    label: 'GPT-6 Astra',
    effort: levels(CODEX_LEVELS, 'medium'),
  }),
  Object.freeze({
    id: 'openai/gpt-6-sol',
    label: 'GPT-6 Sol',
    effort: levels(CODEX_LEVELS, 'medium'),
  }),
  Object.freeze({
    id: 'openai/gpt-6-luna',
    label: 'GPT-6 Luna',
    effort: levels(CODEX_LEVELS, 'medium'),
  }),
  Object.freeze({
    id: 'openai/gpt-5.6-sol',
    label: 'GPT-5.6 Sol',
    effort: levels(CODEX_LEVELS, 'medium'),
  }),
  Object.freeze({
    id: 'openai/gpt-5.6-terra',
    label: 'GPT-5.6 Terra',
    effort: levels(CODEX_LEVELS, 'medium'),
  }),
  Object.freeze({
    id: 'openai/gpt-5.6-luna',
    label: 'GPT-5.6 Luna',
    effort: levels(CODEX_LEVELS, 'medium'),
  }),
  Object.freeze({
    id: 'xai/grok-4.7',
    label: 'Grok 4.7',
    effort: levels(OPENCODE_XAI_LEVELS, 'high'),
  }),
  Object.freeze({
    id: 'xai/grok-4.6',
    label: 'Grok 4.6',
    effort: levels(OPENCODE_XAI_LEVELS, 'high'),
  }),
  Object.freeze({
    id: 'google/gemini-4-argon',
    label: 'Gemini 4 Argon',
    effort: levels(OPENCODE_GOOGLE_LEVELS, 'high'),
  }),
  Object.freeze({
    id: 'google/gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    effort: levels(OPENCODE_GOOGLE_LEVELS, 'high'),
  }),
  Object.freeze({
    id: 'zai-coding-plan/glm-5.3',
    label: 'GLM-5.3',
    effort: levels(OPENCODE_LOW_HIGH_MAX_LEVELS, 'high'),
  }),
  Object.freeze({
    id: 'zai-coding-plan/glm-5.3-highspeed',
    label: 'GLM-5.3 Highspeed',
    effort: levels(OPENCODE_LOW_HIGH_MAX_LEVELS, 'high'),
  }),
  Object.freeze({
    id: 'zai-coding-plan/glm-5.3-flash',
    label: 'GLM-5.3 Flash',
    effort: levels(OPENCODE_LOW_HIGH_MAX_LEVELS, 'high'),
  }),
  Object.freeze({
    id: 'deepseek/deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    effort: levels(OPENCODE_LOW_HIGH_MAX_LEVELS, 'high'),
  }),
  Object.freeze({
    id: 'deepseek/deepseek-flash',
    label: 'DeepSeek V4.1 Flash',
    effort: levels(OPENCODE_LOW_HIGH_MAX_LEVELS, 'high'),
  }),
  Object.freeze({
    id: 'moonshotai/kimi-k3.1-pro',
    label: 'Kimi K3.1 Pro',
    effort: levels(OPENCODE_LOW_HIGH_MAX_LEVELS, 'high'),
  }),
  // Kimi K2.7 Code has no reasoning options on models.dev, so no slider.
  Object.freeze({ id: 'moonshotai/kimi-k2.7-code', label: 'Kimi K2.7 Code' }),
  Object.freeze({
    id: 'alibaba/qwen3.8-max',
    label: 'Qwen3.8 Max',
    effort: levels(OPENCODE_QWEN_LEVELS, 'medium'),
  }),
  Object.freeze({
    id: 'alibaba/qwen3.8-flash',
    label: 'Qwen3.8 Flash',
    effort: levels(OPENCODE_QWEN_LEVELS, 'medium'),
  }),
  Object.freeze({
    id: 'minimax/MiniMax-M3.1-Flash',
    label: 'MiniMax M3.1 Flash',
    effort: levels(CLAUDE_LEVELS, 'high'),
  }),
]);
