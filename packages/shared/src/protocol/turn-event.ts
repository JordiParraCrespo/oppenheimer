import { z } from 'zod/v4';

/**
 * What a runner logs when a headless agent process for a turn exits
 * (`product/versions/mvp/16-automations-architecture.md` §Q4, 23 §4).
 *
 * Like `session.step`, this is an **event payload**, not a link message: it
 * rides `events.append` as a `kind` and a JSON-string `payload`, and the control
 * plane folds it onto `session_turn`. The Go twin is generated from this file
 * (`scripts/emit-turn-event.cjs`).
 *
 * Every field but `exitCode` is optional, and the fold reads each one by name,
 * so the vocabulary only grows: a control plane that predates a field ignores
 * it, and a runner that predates one leaves the column null. The usage fields
 * are what the agent reported — Claude Code reports them, another CLI may not —
 * and an absent one means "not measured", never zero. The cost is the agent's
 * own figure; nothing prices tokens from a list.
 */
export const TURN_ENDED_EVENT_KIND = 'turn.ended';

/** The longest model id `session_turn."model"` keeps. */
export const TURN_MODEL_MAX_LENGTH = 64;

const tokenCount = z.number().int().nonnegative();

export const turnEndedPayloadSchema = z.object({
  /** The wrapper's exit code: 0 completes the turn, anything else fails it. */
  exitCode: z.number().int(),
  /** The agent's own conversation id, for a later `--resume`. */
  agentSessionId: z.string().min(1).max(128).optional(),
  /** The agent's final answer, truncated by the runner to fit the payload cap. */
  result: z.string().optional(),
  /** What the agent says the turn cost, in US dollars. */
  costUsd: z.number().nonnegative().optional(),
  /** How many tool uses the agent was refused during the turn. */
  permissionDenials: z.number().int().nonnegative().optional(),
  outputRef: z.string().max(512).optional(),
  /** The model that did the turn's work, as the agent names it. */
  model: z.string().min(1).max(TURN_MODEL_MAX_LENGTH).optional(),
  /** Uncached input tokens, over every model the turn used. */
  inputTokens: tokenCount.optional(),
  outputTokens: tokenCount.optional(),
  /** Input tokens served from the prompt cache. */
  cacheReadTokens: tokenCount.optional(),
  /** Input tokens written to the prompt cache. */
  cacheWriteTokens: tokenCount.optional(),
});

export type TurnEndedPayload = z.infer<typeof turnEndedPayloadSchema>;
