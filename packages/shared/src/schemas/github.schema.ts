import { z } from 'zod';
import { githubInstallationIdSchema } from './primitives.js';

/**
 * GitHub App installation shapes. There is no repository schema and no
 * repository table: the installation *is* the allowlist and GitHub answers it,
 * so the picker lists repositories live and a checkout records the ids it took.
 */

/**
 * The nonce the API mints for one GitHub App install: base64url, so it rides a
 * query string untouched and never contains the `.` the console's walk prefix
 * is split on.
 */
export const installStateSchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

/**
 * `POST /installations`.
 *
 * The field is `githubInstallationId`, not `installationId`: this is GitHub's
 * own numeric id from the App redirect, not the UUID of our own row
 * (`./primitives` says why the two never share a name).
 *
 * `code` is not optional plumbing: it is the only proof the caller can see the
 * installation they are claiming. Without it a forged id would hand them
 * one-hour tokens to another account's repositories, so the handler exchanges
 * the OAuth code, calls `GET /user/installations`, verifies, and discards it.
 * There is no fallback.
 *
 * `state` is the other half. The code proves which GitHub account can see the
 * installation; the state proves this console user started this install. It
 * is the nonce `POST /installations/install-state` minted, single use and
 * bound to the caller and the workspace — without it, a callback URL someone
 * else stopped halfway would connect their installation to whoever opened it.
 */
export const connectInstallationSchema = z.object({
  githubInstallationId: githubInstallationIdSchema,
  /** The OAuth code GitHub attaches to the same redirect. Never stored. */
  code: z.string().min(1),
  /** The install state, nonce only: the console strips its walk prefix first. */
  state: installStateSchema,
});

export type ConnectInstallationDto = z.infer<typeof connectInstallationSchema>;

/**
 * A person's own GitHub tokens, for repositories the App will never be
 * installed on (`product/next-steps/0.2-pull-requests.md` §6.2). What kind a
 * token is GitHub's prefix says: `github_pat_` fine-grained, `ghp_` classic.
 */
export const GITHUB_TOKEN_KINDS = ['fine_grained', 'classic', 'other'] as const;
export type GithubTokenKind = (typeof GITHUB_TOKEN_KINDS)[number];

/** The name a person gives a token so the picker can tell them apart. */
export const githubTokenLabelSchema = z.string().trim().min(1).max(80);

/** `POST /github/tokens`. The token is asked of GitHub before anything is kept, and never returned. */
export const addGithubTokenSchema = z.object({
  label: githubTokenLabelSchema,
  token: z
    .string()
    .trim()
    .min(20)
    .max(255)
    .regex(/^[A-Za-z0-9_]+$/, 'A GitHub token is letters, digits and underscores'),
});
export type AddGithubTokenDto = z.infer<typeof addGithubTokenSchema>;

/** `PATCH /github/tokens/:id`. */
export const renameGithubTokenSchema = z.object({ label: githubTokenLabelSchema });
export type RenameGithubTokenDto = z.infer<typeof renameGithubTokenSchema>;

/** `PUT /github/tokens/pins/:githubRepoId`: which of the caller's tokens reads the repository. */
export const pinGithubTokenSchema = z.object({ tokenId: z.string().uuid() });
export type PinGithubTokenDto = z.infer<typeof pinGithubTokenSchema>;
