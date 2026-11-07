import { z } from 'zod/v4';
import { commandIdSchema, sessionIdSchema } from './primitives.js';

/**
 * The files an agent shared from its session on the link
 * (`runner sessions send-file`, `product/next-steps/agent-tools.md` §7): the
 * messages behind the `shared.preview` capability. Part of
 * `protocolMessageSchema`, which is where every kind is listed.
 *
 * The control plane knows a shared file by the `file.shared` event the runner
 * logged (its id, name, type, size, caption, whether it has a preview); the
 * bytes stay on the host. A bot that shows one asks the host for the JPEG
 * preview the runner kept when the file was shared.
 */

/**
 * The most a preview's base64 may be: the runner keeps a whole shared entry
 * under 64 KB, so its JPEG preview is under that, and base64 is four thirds.
 */
export const SHARED_PREVIEW_MAX_BASE64 = 96 * 1024;

/**
 * Read the JPEG preview of one file the session's agent shared. Sent only to
 * a runner whose hello named `shared.preview`; answered by `shared.preview`
 * with the same `commandId`, or by `command.failed`: `SESS_001` the session
 * is not on this host, `SESS_016` it has no shared file by that id,
 * `SESS_017` the file has no preview (not an image, or too large to read).
 */
export const sharedPreviewGetSchema = z.object({
  type: z.literal('shared.preview.get'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  /** The runner's id for the file, from its `file.shared` event. */
  fileId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
});

export type SharedPreviewGetMessage = z.infer<typeof sharedPreviewGetSchema>;

/** The preview: a JPEG, base64, the runner's own, never the file itself. */
export const sharedPreviewSchema = z.object({
  type: z.literal('shared.preview'),
  commandId: commandIdSchema,
  mediaType: z.literal('image/jpeg'),
  data: z.base64().max(SHARED_PREVIEW_MAX_BASE64),
});

export type SharedPreviewMessage = z.infer<typeof sharedPreviewSchema>;
