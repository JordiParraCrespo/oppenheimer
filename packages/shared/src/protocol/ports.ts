import { z } from 'zod/v4';
import { attachmentIdSchema, commandIdSchema, sessionIdSchema } from './primitives.js';

/**
 * A session's ports on the link (`product/versions/mvp/30-session-previews.md`):
 * the messages behind the `port.forward` capability. Part of
 * `protocolMessageSchema`, which is where every kind is listed; kept here so
 * the union stays the index of kinds rather than the home of every shape.
 *
 * The flow control a port attachment's bytes follow is the link's one credit
 * window (`ATTACHMENT_CREDIT_WINDOW_BYTES`, `attachment.credit`), in each
 * direction: a side sends while the other has credited room, and credits what
 * its reader took. A side that receives past the window may close the
 * attachment.
 */

/** A TCP port a preview may reach: the session's own, never a system one. A fresh schema per use, like `sdp`. */
const forwardedPort = () => z.number().int().min(1024).max(65535);

/** How many ports one `port.listing` names at most. */
export const PORT_LISTING_MAX_ENTRIES = 64;

/**
 * The ports the session's own processes listen on. Sent only to a runner
 * whose hello named `port.forward`; answered by `port.listing` with the same
 * `commandId`, or by `command.failed` (`PORT_003` the host cannot tell).
 */
export const portListSchema = z.object({
  type: z.literal('port.list'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
});

export type PortListMessage = z.infer<typeof portListSchema>;

/** The session's listening ports, one per port, in order. */
export const portListingSchema = z.object({
  type: z.literal('port.listing'),
  commandId: commandIdSchema,
  ports: z
    .array(
      z.object({
        port: forwardedPort(),
        /** The command holding it ("node"), for the console's picker. */
        process: z.string().max(100).optional(),
      }),
    )
    .max(PORT_LISTING_MAX_ENTRIES),
});

export type PortListingMessage = z.infer<typeof portListingSchema>;

/**
 * Open one TCP connection to a port the session listens on, as an
 * attachment: from `port.opened` on, binary frames under the id carry its
 * bytes both ways, each direction under its own `attachment.credit` window.
 * Refused with `command.failed`: `PORT_001` the session does not listen on
 * it, `PORT_002` nothing answered.
 */
export const portOpenSchema = z.object({
  type: z.literal('port.open'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  attachmentId: attachmentIdSchema,
  port: forwardedPort(),
});

export type PortOpenMessage = z.infer<typeof portOpenSchema>;

/** The runner connected; bytes may flow. */
export const portOpenedSchema = z.object({
  type: z.literal('port.opened'),
  attachmentId: attachmentIdSchema,
});

export type PortOpenedMessage = z.infer<typeof portOpenedSchema>;

/**
 * The control plane hangs up a port attachment: the runner closes the
 * connection. The runner's own hang-up is `attachment.closed`.
 */
export const portCloseSchema = z.object({
  type: z.literal('port.close'),
  attachmentId: attachmentIdSchema,
});

export type PortCloseMessage = z.infer<typeof portCloseSchema>;
