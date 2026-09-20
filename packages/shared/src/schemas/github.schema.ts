import { z } from 'zod';
import { githubInstallationIdSchema } from './primitives';

/**
 * GitHub App installation shapes. There is no repository schema and no
 * repository table: the installation *is* the allowlist and GitHub answers it,
 * so the picker lists repositories live and a checkout records the ids it took.
 *
 * Schemas state the constraint only, never a message (`.agents/rules/forms.md`).
 */

/**
 * `POST /installations`.
 *
 * The field is `githubInstallationId`, not `installationId`: this is GitHub's
 * own numeric id from the App redirect, while a session checkout's
 * `installationId` is the UUID of our own row. A connect-then-create flow
 * touches both, and one name for two universes is how the wrong one gets passed
 * through.
 *
 * `code` is not optional plumbing: it is the only proof the caller can see the
 * installation they are claiming. Without it a forged id would hand them
 * one-hour tokens to another account's repositories, so the handler exchanges
 * the OAuth code, calls `GET /user/installations`, verifies, and discards it.
 * There is no fallback.
 */
export const connectInstallationSchema = z.object({
  githubInstallationId: githubInstallationIdSchema,
  /** The OAuth code GitHub attaches to the same redirect. Never stored. */
  code: z.string().min(1),
});

export type ConnectInstallationDto = z.infer<typeof connectInstallationSchema>;
