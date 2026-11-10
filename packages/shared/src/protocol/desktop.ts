import { z } from 'zod/v4';
import { attachmentIdSchema, commandIdSchema } from './primitives.js';

/**
 * A host's desktop on the link (`product/research/device-streaming.md`,
 * "A host's desktop"): the messages behind the `desktop.stream` capability.
 * Part of `protocolMessageSchema`, which is where every kind is listed; kept
 * here so the union stays the index of kinds rather than the home of every
 * shape.
 *
 * The desktop is the host's, not a session's: the screen-sharing server the
 * host already runs on its loopback (macOS Screen Sharing, TigerVNC,
 * x11vnc), which the host's owner turned on for the runner with
 * `runner desktop on`. Nothing on the link turns it on.
 *
 * From `desktop.opened` on, binary frames under the attachment id carry RFB
 * (the VNC protocol, RFC 6143) both ways, each direction under its own
 * `attachment.credit` window, as a port attachment's bytes do. The runner has
 * already completed the server's own authentication with the credentials it
 * keeps on the host, so the browser is offered a stream that asks for none:
 * no password ever crosses the link.
 */

/**
 * Open the host's desktop for one browser. Answered with `desktop.opened`,
 * or `command.failed`: `DESKTOP_001` the host does not share its desktop,
 * `DESKTOP_002` nothing that speaks RFB answers on its port, `DESKTOP_003`
 * the server refused the host's credentials, `DESKTOP_004` the server asks
 * for a kind of authentication the runner does not speak. Sent only to a
 * runner that named `desktop.stream`.
 */
export const desktopOpenSchema = z.object({
  type: z.literal('desktop.open'),
  commandId: commandIdSchema,
  attachmentId: attachmentIdSchema,
  /**
   * Whether the browser may click and type. Off, the runner drops every key,
   * pointer, clipboard and resize message the browser sends, whatever reached
   * the link, so the stream only watches. `desktop.control` changes it.
   */
  control: z.boolean(),
});

export type DesktopOpenMessage = z.infer<typeof desktopOpenSchema>;

/** The runner reached the desktop and authenticated; RFB may flow. */
export const desktopOpenedSchema = z.object({
  type: z.literal('desktop.opened'),
  attachmentId: attachmentIdSchema,
});

export type DesktopOpenedMessage = z.infer<typeof desktopOpenedSchema>;

/** The reader takes control of an open desktop, or gives it back to watching. */
export const desktopControlSchema = z.object({
  type: z.literal('desktop.control'),
  attachmentId: attachmentIdSchema,
  control: z.boolean(),
});

export type DesktopControlMessage = z.infer<typeof desktopControlSchema>;

/**
 * The control plane hangs up a desktop attachment: the runner closes its
 * connection to the server. The runner's own hang-up is `attachment.closed`.
 */
export const desktopCloseSchema = z.object({
  type: z.literal('desktop.close'),
  attachmentId: attachmentIdSchema,
});

export type DesktopCloseMessage = z.infer<typeof desktopCloseSchema>;
