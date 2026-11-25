import { z } from 'zod/v4';
import { checkoutIdSchema, commandIdSchema, gitRefSchema, sessionIdSchema } from './primitives.js';

/**
 * A session's changes, read off its worktrees on request: the messages behind
 * the `session.changes.read` capability, which the console's Review reads
 * (`product/versions/mvp/33-session-tabs.md` §5). Part of
 * `protocolMessageSchema`, which is where every kind is listed.
 *
 * Nothing is kept by the control plane: each read is git run on the host,
 * now. The answer is bounded well under the link's frame
 * (`LINK_MAX_FRAME_BYTES`), since it rides the control queue ahead of the
 * session's panes: past a bound, a file keeps its counts and loses its patch,
 * and past the file bound the rest are counted and left out.
 */

/** What a read compares the worktree with. */
export const SESSION_CHANGES_SCOPES = [
  /**
   * Everything since the branch left its base: the commits on it and the
   * edits not committed yet, against where it meets `origin/<base>`.
   */
  'base',
  /** Only the edits not committed yet, against the branch's last commit. */
  'uncommitted',
] as const;

export type SessionChangesScope = (typeof SESSION_CHANGES_SCOPES)[number];

/** The most files one checkout's answer names. */
export const SESSION_CHANGES_MAX_FILES = 500;

/** The most bytes one file's patch carries; a longer one is left out, its counts kept. */
export const SESSION_CHANGES_FILE_PATCH_MAX_BYTES = 64 * 1024;

/**
 * The most bytes the patches of one answer add up to, across its checkouts:
 * past it, the files that follow keep their counts and lose their patches.
 */
export const SESSION_CHANGES_PATCH_MAX_BYTES = 256 * 1024;

/** A path inside a checkout, relative to its root, `/`-separated as git prints it. */
const changedPathSchema = () => z.string().min(1).max(4096);

/** What happened to a file, as git names it; `untracked` is new and never added. */
export const SESSION_CHANGE_STATUSES = [
  'added',
  'modified',
  'deleted',
  'renamed',
  'copied',
  'type_changed',
  'untracked',
] as const;

export const sessionChangedFileSchema = z.object({
  path: changedPathSchema(),
  /** Where a renamed or copied file came from. */
  oldPath: changedPathSchema().optional(),
  status: z.enum(SESSION_CHANGE_STATUSES),
  /** Lines added and removed; 0 and 0 for a binary file. */
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  binary: z.boolean().optional(),
  /**
   * The file's unified diff, from its `diff --git` line: absent for a binary
   * file, or when it was left out by a bound (`patchOmitted`).
   */
  patch: z.string().max(SESSION_CHANGES_FILE_PATCH_MAX_BYTES).optional(),
  /** The patch was left out: longer than one file's bound, or past the answer's. */
  patchOmitted: z.boolean().optional(),
});

export type SessionChangedFile = z.infer<typeof sessionChangedFileSchema>;

export const sessionCheckoutChangesSchema = z.object({
  /** `owner/name`. */
  repo: gitRefSchema,
  /** The control plane's checkout; absent for a session the runner's CLI made. */
  checkoutId: checkoutIdSchema.optional(),
  /** What the session's branch was cut from in this repository. */
  baseBranch: gitRefSchema.optional(),
  /**
   * The commit the read compared with: where the branch meets
   * `origin/<baseBranch>` for `base`, the branch's last commit for
   * `uncommitted`. Absent when there is none to compare with yet (a branch
   * with no commit).
   */
  base: z
    .string()
    .regex(/^[0-9a-f]{40}([0-9a-f]{24})?$/)
    .optional(),
  /**
   * `base` asked, but the branch's history did not reach its base yet (the
   * store is still fetching it), so the read compared with
   * `origin/<baseBranch>` itself: it also shows, reversed, what the base
   * gained since the branch was cut.
   */
  approximate: z.boolean().optional(),
  files: z.array(sessionChangedFileSchema).max(SESSION_CHANGES_MAX_FILES),
  /** Files past `SESSION_CHANGES_MAX_FILES`, counted and left out. */
  omittedFiles: z.number().int().nonnegative().optional(),
});

export type SessionCheckoutChanges = z.infer<typeof sessionCheckoutChangesSchema>;

/**
 * Read the session's changes. Sent only to a runner whose hello named
 * `session.changes.read`; answered by `session.changes` with the same
 * `commandId`, or by `command.failed`: `SESS_001` the session is not on this
 * host.
 */
export const sessionChangesReadSchema = z.object({
  type: z.literal('session.changes.read'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  scope: z.enum(SESSION_CHANGES_SCOPES),
});

export type SessionChangesReadMessage = z.infer<typeof sessionChangesReadSchema>;

/**
 * A session's changes, one entry per checkout, the first checkout first. A
 * folder session has no checkouts and answers none. `checkouts` and each
 * `files` are always arrays, never null.
 */
export const sessionChangesSchema = z.object({
  type: z.literal('session.changes'),
  commandId: commandIdSchema,
  sessionId: sessionIdSchema,
  scope: z.enum(SESSION_CHANGES_SCOPES),
  checkouts: z.array(sessionCheckoutChangesSchema).max(16),
});

export type SessionChangesMessage = z.infer<typeof sessionChangesSchema>;
