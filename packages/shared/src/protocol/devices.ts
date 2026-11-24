import { z } from 'zod/v4';
import { DEVICE_BUTTONS, DEVICE_INPUT_KINDS, DEVICE_KEYS } from './link.js';
import { attachmentIdSchema, commandIdSchema, sessionIdSchema } from './primitives.js';

/**
 * A session's device on the link: the messages behind the `device.screen`
 * capability. Part of `protocolMessageSchema`, which is where every kind is
 * listed; kept here so the union stays the index of kinds rather than the home
 * of every shape.
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

/** The most devices a `device.info` lists: a host offers a handful. */
export const DEVICE_CHOICES_MAX = 32;

/**
 * One device the host offers, as a session may pick it: `free` is a device no
 * other session holds (the session's own is free to it).
 */
export const deviceChoiceSchema = z.object({
  serial: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  platform: z.enum(['android', 'ios']),
  free: z.boolean(),
});

export type DeviceChoice = z.infer<typeof deviceChoiceSchema>;

/**
 * The runner's answer to `device.attach`, and to each `device.select`: which
 * device the session has, and the devices it could move to. A runner that
 * cannot move a session lists none, and the console offers no picker.
 */
export const deviceInfoSchema = z.object({
  type: z.literal('device.info'),
  attachmentId: attachmentIdSchema,
  /** The host's id for it: an adb serial, a simulator UDID. */
  serial: z.string().min(1).max(200),
  /** What the pane's header calls it ("Android emulator"). */
  name: z.string().min(1).max(200),
  platform: z.enum(['android', 'ios']),
  /** Every device the host offers now, the session's own included. */
  devices: z.array(deviceChoiceSchema).max(DEVICE_CHOICES_MAX).optional(),
});

export type DeviceInfoMessage = z.infer<typeof deviceInfoSchema>;

const devicePoint = () => z.number().min(0).max(1);

/** The longest swipe a reader's drag becomes: a drag held longer is cut to it. */
export const DEVICE_SWIPE_MAX_MS = 10_000;

/**
 * How long the reader's finger was down, in milliseconds: the swipe is played
 * back at the speed it was made. Absent, the device's own default (300 ms).
 */
export const deviceSwipeDurationSchema = () => z.number().int().min(1).max(DEVICE_SWIPE_MAX_MS);

/**
 * One gesture or keystroke for a device, from the console. Points are
 * fractions of the screen (0 to 1 from the top left), so the browser never
 * needs the device's resolution. Which fields a kind reads: `tap` x and y,
 * `swipe` x, y, toX, toY, durationMs and momentum, `text` text, `key` key,
 * `button` button. A swipe with `momentum` was a flick: the finger left the
 * screen moving, and the content flings on; without it the content stops
 * where the finger lifted. The
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
  durationMs: deviceSwipeDurationSchema().optional(),
  momentum: z.boolean().optional(),
  text: z.string().min(1).max(1000).optional(),
  key: z.enum(DEVICE_KEYS).optional(),
  button: z.enum(DEVICE_BUTTONS).optional(),
});

export type DeviceInputMessage = z.infer<typeof deviceInputSchema>;

/**
 * The reader moves the session onto another of its host's devices, one
 * `device.info` listed as free. The runner releases the session's old device,
 * holds this one, streams its screen on the same attachment and answers with
 * `device.info`; a device another session took meanwhile leaves the session
 * where it was, and the answer says so. Sent only on an attachment whose
 * `device.info` listed `devices`.
 */
export const deviceSelectSchema = z.object({
  type: z.literal('device.select'),
  attachmentId: attachmentIdSchema,
  serial: z.string().min(1).max(200),
});

export type DeviceSelectMessage = z.infer<typeof deviceSelectSchema>;

/** The control plane frees a device attachment: the browser went away. */
export const deviceDetachSchema = z.object({
  type: z.literal('device.detach'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  attachmentId: attachmentIdSchema,
});

export type DeviceDetachMessage = z.infer<typeof deviceDetachSchema>;
