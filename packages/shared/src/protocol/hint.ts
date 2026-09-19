import { z } from 'zod/v4';

/**
 * The hint vocabulary, and it is **closed**. A hint may ride a heartbeat reply
 * or an attach ticket, and it is the only thing the runner link and the browser
 * attach socket share (`product/versions/mvp/01-protocol.md`, plus
 * `host_offline` from note 10).
 */
export const HINT_KINDS = [
  'update_available',
  'update_required',
  'blocked',
  'host_offline',
] as const;

export type HintKind = (typeof HINT_KINDS)[number];

export const hintKindSchema = z.enum(HINT_KINDS);

/**
 * A hint, as a message of its own on the link. `retryAfterSeconds` is what
 * makes `blocked` actionable rather than a dead end.
 */
export const hintSchema = z.object({
  type: z.literal('hint'),
  kind: hintKindSchema,
  retryAfterSeconds: z.number().int().min(0).optional(),
  /** Free-form operator detail. Never a translated string: the console renders the kind. */
  detail: z.string().max(500).optional(),
});

export type HintMessage = z.infer<typeof hintSchema>;
