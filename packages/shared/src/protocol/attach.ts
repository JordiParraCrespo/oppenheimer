import { z } from 'zod/v4';
import { attachTicketHintSchema } from './hint.js';
import {
  CHAT_BATCH_MAX_ENTRIES,
  CHAT_ENTRY_MAX_BYTES,
  DEVICE_BUTTONS,
  DEVICE_INPUT_KINDS,
  DEVICE_KEYS,
} from './link.js';

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

/**
 * The browser's WebRTC offer for this attachment (22), with every candidate in
 * it. Sent only after `attached` carried `direct`.
 */
export const attachDirectOfferSchema = z.object({
  type: z.literal('direct.offer'),
  sdp: z
    .string()
    .min(1)
    .max(16 * 1024),
});

/**
 * The browser's input moves to the data channel after `offset` keystroke
 * bytes sent on this socket (`attachment.path` on the link). In the other
 * direction, the runner's output moves after `offset` PTY bytes.
 */
export const attachDirectPathSchema = z.object({
  type: z.literal('direct.path'),
  offset: z.number().int().min(0),
});

const devicePoint = () => z.number().min(0).max(1);

/**
 * A gesture or key for the session's device, on a device attachment (a
 * ticket minted with `target: 'device'`). Relayed as `device.input`; the
 * runner applies it to the session's own device.
 */
export const attachDeviceInputSchema = z.object({
  type: z.literal('device.input'),
  kind: z.enum(DEVICE_INPUT_KINDS),
  x: devicePoint().optional(),
  y: devicePoint().optional(),
  toX: devicePoint().optional(),
  toY: devicePoint().optional(),
  text: z.string().min(1).max(1000).optional(),
  key: z.enum(DEVICE_KEYS).optional(),
  button: z.enum(DEVICE_BUTTONS).optional(),
});

export type AttachDeviceInput = Omit<z.infer<typeof attachDeviceInputSchema>, 'type'>;

export const attachClientMessageSchema = z.discriminatedUnion('type', [
  attachResizeSchema,
  attachCreditSchema,
  attachDirectOfferSchema,
  attachDirectPathSchema,
  attachDeviceInputSchema,
]);

export type AttachClientMessage = z.infer<typeof attachClientMessageSchema>;

/** The runner has been told to attach; PTY frames follow. */
export const attachAttachedSchema = z.object({
  type: z.literal('attached'),
  window: z.number().int().min(0),
  /**
   * Present when this attachment may move to a direct path (22): the host can
   * answer, and the relay allows it for this audience. The ICE servers are the
   * ones the browser's peer connection gathers with.
   */
  direct: z.object({ iceServers: z.array(z.string().min(1).max(256)).max(8) }).optional(),
});

/** The runner's answer to `direct.offer`. */
export const attachDirectAnswerSchema = z.object({
  type: z.literal('direct.answer'),
  sdp: z
    .string()
    .min(1)
    .max(16 * 1024),
});

/** No direct path for this attachment; it stays on this socket. */
export const attachDirectUnavailableSchema = z.object({
  type: z.literal('direct.unavailable'),
  reason: z.string().max(200),
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

/**
 * The runner's `attachment.chat`, relayed as it came: entries of the agent's
 * transcript for the chat view beside the terminal. `reset` starts the history
 * over (the first message, or a transcript that was replaced).
 */
export const attachChatSchema = z.object({
  type: z.literal('chat'),
  reset: z.boolean().optional(),
  entries: z.array(z.string().min(1).max(CHAT_ENTRY_MAX_BYTES)).max(CHAT_BATCH_MAX_ENTRIES),
});

/**
 * On a device attachment, which device the session has: the runner's
 * `device.info`. JPEG frames of its screen follow as binary frames, each one
 * whole image, and the browser credits each one's bytes once it is drawn.
 */
export const attachDeviceSchema = z.object({
  type: z.literal('device'),
  serial: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  platform: z.enum(['android', 'ios']),
});

export const attachServerMessageSchema = z.discriminatedUnion('type', [
  attachAttachedSchema,
  attachHintSchema,
  attachRefusedSchema,
  attachClosedSchema,
  attachDirectAnswerSchema,
  attachDirectUnavailableSchema,
  attachDirectPathSchema,
  attachChatSchema,
  attachDeviceSchema,
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
