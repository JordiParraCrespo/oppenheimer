import { z } from 'zod/v4';
import { DEVICE_BUTTONS, DEVICE_INPUT_KINDS, DEVICE_KEYS } from './link.js';
import { attachmentIdSchema, commandIdSchema, sessionIdSchema } from './primitives.js';

/**
 * A session's device on the link (`product/research/device-streaming.md`):
 * the messages behind the `device.screen` capability. Part of
 * `protocolMessageSchema`, which is where every kind is listed; kept here so
 * the union stays the index of kinds rather than the home of every shape.
 */

/**
 * Open a session's device screen for one browser: the runner answers with
 * `device.info`, then streams the screen under `attachmentId` as binary
 * frames, each one whole JPEG image, never larger than the link's frame cap.
 * A frame is sent only against credit (`attachment.credit`, in bytes, as for a
 * PTY), and a frame that has no credit is replaced by the next: a slow viewer
 * sees fewer frames, never older ones, and never backs up the link. A session
 * with no device on its host is refused with `command.failed`. Sent only to a
 * runner that named `device.screen`.
 */
export const deviceAttachSchema = z.object({
  type: z.literal('device.attach'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  attachmentId: attachmentIdSchema,
});

export type DeviceAttachMessage = z.infer<typeof deviceAttachSchema>;

/** The runner's answer to `device.attach`: which device the session has. */
export const deviceInfoSchema = z.object({
  type: z.literal('device.info'),
  attachmentId: attachmentIdSchema,
  /** The host's id for it: an adb serial, a simulator UDID. */
  serial: z.string().min(1).max(200),
  /** What the pane's header calls it ("Android emulator"). */
  name: z.string().min(1).max(200),
  platform: z.enum(['android', 'ios']),
});

export type DeviceInfoMessage = z.infer<typeof deviceInfoSchema>;

const devicePoint = () => z.number().min(0).max(1);

/**
 * One gesture or keystroke for a device, from the console. Points are
 * fractions of the screen (0 to 1 from the top left), so the browser never
 * needs the device's resolution. Which fields a kind reads: `tap` x and y,
 * `swipe` x, y, toX and toY, `text` text, `key` key, `button` button. The
 * runner applies it to the session's own device; the message cannot name
 * another.
 */
export const deviceInputSchema = z.object({
  type: z.literal('device.input'),
  attachmentId: attachmentIdSchema,
  kind: z.enum(DEVICE_INPUT_KINDS),
  x: devicePoint().optional(),
  y: devicePoint().optional(),
  toX: devicePoint().optional(),
  toY: devicePoint().optional(),
  text: z.string().min(1).max(1000).optional(),
  key: z.enum(DEVICE_KEYS).optional(),
  button: z.enum(DEVICE_BUTTONS).optional(),
});

export type DeviceInputMessage = z.infer<typeof deviceInputSchema>;

/** The control plane frees a device attachment: the browser went away. */
export const deviceDetachSchema = z.object({
  type: z.literal('device.detach'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  attachmentId: attachmentIdSchema,
});

export type DeviceDetachMessage = z.infer<typeof deviceDetachSchema>;
