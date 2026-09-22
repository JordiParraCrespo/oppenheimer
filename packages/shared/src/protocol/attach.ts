import { z } from 'zod/v4';
import { attachTicketHintSchema } from './hint';

/**
 * The browser attach socket's control vocabulary — the second of the two
 * sockets `product/versions/mvp/01-protocol.md` decides, and deliberately not
 * the runner link's: one socket per attachment, so no attachment id travels in
 * a frame, and a PTY read reaches the terminal as a bare binary frame.
 *
 * Binary frames: control plane → browser is PTY output, browser → control plane
 * is keystrokes. Text frames are the JSON below, and nothing else.
 */

/** The viewport, sent once on open (before the attach is dispatched) and on every change. */
export const attachResizeSchema = z.object({
  type: z.literal('resize'),
  cols: z.number().int().min(1).max(10_000),
  rows: z.number().int().min(1).max(10_000),
});

/** Bytes the terminal consumed, relayed to the runner as `attachment.credit`. */
export const attachCreditSchema = z.object({
  type: z.literal('credit'),
  bytes: z.number().int().positive(),
});

export const attachClientMessageSchema = z.discriminatedUnion('type', [
  attachResizeSchema,
  attachCreditSchema,
]);

export type AttachClientMessage = z.infer<typeof attachClientMessageSchema>;

/** The runner has been told to attach; PTY frames follow. */
export const attachAttachedSchema = z.object({
  type: z.literal('attached'),
  window: z.number().int().min(0),
});

/** A hint, in the attach ticket's vocabulary — `host_offline` is the one that matters here. */
export const attachHintSchema = attachTicketHintSchema.extend({
  type: z.literal('hint'),
});

/** The runner refused the attach (`command.failed`), with its catalog code. */
export const attachRefusedSchema = z.object({
  type: z.literal('refused'),
  code: z.string().min(1).max(32),
  detail: z.string().max(500).optional(),
});

/**
 * The relay is about to close this socket for a reason no reconnect can
 * change: the ticket was not honoured, the person is no longer a member, or
 * the session is stopped or resolved. It is sent on an *established* socket
 * before the close, because a browser's WebSocket cannot see the status of a
 * refused upgrade — it sees 1006 and would retry.
 */
export const attachClosedSchema = z.object({
  type: z.literal('closed'),
  reason: z.enum(['unauthorized', 'forbidden', 'stopped', 'resolved', 'missing']),
});

export const attachServerMessageSchema = z.discriminatedUnion('type', [
  attachAttachedSchema,
  attachHintSchema,
  attachRefusedSchema,
  attachClosedSchema,
]);

export type AttachServerMessage = z.infer<typeof attachServerMessageSchema>;

/**
 * Close codes the relay uses on the attach socket. They are in the private
 * range so a proxy never invents one, and each names a reason the console can
 * render without parsing a string.
 */
export const ATTACH_CLOSE_CODES = Object.freeze({
  /** No ticket, an unknown ticket, or one already redeemed. */
  UNAUTHORIZED: 4401,
  /** The person is no longer a member of the session's workspace. */
  FORBIDDEN: 4403,
  /** The session is gone or resolved; nothing will attach again. */
  SESSION_UNAVAILABLE: 4404,
  /** The session is stopped: tmux is gone, the checkouts are kept, Restart applies. */
  SESSION_STOPPED: 4410,
  /** The host holds no link right now; `host_offline` was sent first. */
  HOST_OFFLINE: 4503,
  /** The runner refused the attach; `refused` was sent first. */
  REFUSED: 4409,
  /** The runner's link dropped while attached. */
  LINK_LOST: 4504,
});
