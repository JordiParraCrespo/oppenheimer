import { z } from 'zod/v4';

/**
 * Hints, split by the socket that carries them.
 *
 * `product/versions/mvp/01-protocol.md` closes the link's vocabulary at three
 * kinds, and says the two sockets share only the kinds they both need. An
 * attach ticket needs a fourth — the host has no link right now — and that one
 * is meaningless on the link itself: a runner that is connected enough to send
 * a frame cannot coherently report itself offline. Keeping one union for both
 * let it.
 */

/** The link's closed vocabulary. */
export const HINT_KINDS = ['update_available', 'update_required', 'blocked'] as const;

export type HintKind = (typeof HINT_KINDS)[number];

export const hintKindSchema = z.enum(HINT_KINDS);

/**
 * A hint on the runner link. `retryAfterSeconds` is what makes `blocked`
 * actionable rather than a dead end.
 */
export const hintSchema = z.object({
  type: z.literal('hint'),
  kind: hintKindSchema,
  retryAfterSeconds: z.number().int().min(0).optional(),
  /** Free-form operator detail. Never a translated string: the console renders the kind. */
  detail: z.string().max(500).optional(),
});

export type HintMessage = z.infer<typeof hintSchema>;

/**
 * The link's kinds plus `host_offline`, which only an attach ticket can carry.
 *
 * Exported for the API's `POST /sessions/{id}/attach-ticket` response, so the
 * ticket's `hint` and the link's `hint` cannot silently drift apart while still
 * being two different sets.
 */
export const ATTACH_TICKET_HINT_KINDS = [...HINT_KINDS, 'host_offline'] as const;

export type AttachTicketHintKind = (typeof ATTACH_TICKET_HINT_KINDS)[number];

export const attachTicketHintSchema = z.object({
  kind: z.enum(ATTACH_TICKET_HINT_KINDS),
  retryAfterSeconds: z.number().int().min(0).optional(),
  detail: z.string().max(500).optional(),
});

export type AttachTicketHint = z.infer<typeof attachTicketHintSchema>;
