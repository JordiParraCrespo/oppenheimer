import { z } from 'zod';

/**
 * A file an agent shared from its session (`runner sessions send-file`,
 * `product/next-steps/agent-tools.md` §1 and §7): logged by the runner as
 * `file.shared` with what the file is — never its path on the host, never its
 * bytes — and kept on the session, the last `SESSION_SHARED_FILES_MAX`, so a
 * bot can list them and ask the host for an image's preview
 * (`shared.preview.get`).
 */

/** The event kind a shared file is logged as. */
export const FILE_SHARED_EVENT_KIND = 'file.shared';

/** How many shared files the session keeps, the newest last. */
export const SESSION_SHARED_FILES_MAX = 20;

/** The runner's own bound on a caption, in bytes. */
export const SESSION_SHARED_FILE_CAPTION_MAX = 500;

/** The runner's id for a shared file: 16 hex characters today. */
export const sharedFileIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

/** What the runner logs. */
export const fileSharedPayloadSchema = z.object({
  id: sharedFileIdSchema,
  /** The file's base name, no folder. */
  name: z.string().min(1).max(255),
  mediaType: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  caption: z.string().max(SESSION_SHARED_FILE_CAPTION_MAX).optional(),
  /** The runner kept a JPEG preview of it, which `shared.preview.get` asks for. */
  hasPreview: z.boolean(),
});

export type FileSharedPayload = z.infer<typeof fileSharedPayloadSchema>;

/** What the session keeps: each shared file and when it was logged. */
export const sessionSharedFileSchema = fileSharedPayloadSchema.extend({
  at: z.string().datetime(),
});

export type SessionSharedFile = z.infer<typeof sessionSharedFileSchema>;
