import { z } from 'zod';

/**
 * GitHub App installation shapes. There is no repository schema and no
 * repository table: the installation *is* the allowlist and GitHub answers it,
 * so the picker lists repositories live and a checkout records the three ids it
 * took (`product/versions/mvp/10-api-modules-and-data-model.md`).
 *
 * Schemas state the constraint only, never a message (`.agents/rules/forms.md`).
 */

/**
 * `POST /installations`. Both halves are required, and the `code` is not
 * optional plumbing: it is the only proof the caller can actually see the
 * installation they are claiming. Without it a forged `installationId` would
 * hand them one-hour tokens to another account's repositories, so the handler
 * exchanges the OAuth code, calls `GET /user/installations`, verifies, and
 * discards it. There is no fallback.
 */
export const connectInstallationSchema = z.object({
  /** GitHub's own installation id, as it arrives on the redirect. */
  installationId: z.number().int().positive(),
  /** The OAuth code GitHub attaches to the same redirect. Never stored. */
  code: z.string().min(1),
});

export type ConnectInstallationDto = z.infer<typeof connectInstallationSchema>;
