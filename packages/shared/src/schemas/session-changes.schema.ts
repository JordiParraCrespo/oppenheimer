import { z } from 'zod';
import { SESSION_CHANGE_STATUSES, SESSION_CHANGES_SCOPES } from '../protocol/session-changes.js';

/**
 * A session's changes as the console reads them (`GET /sessions/{id}/changes`):
 * what each of its checkouts changed, read off the host now with git. Nothing
 * is stored: each read asks the host's runner. The Review reads it
 * (`product/design/console/session-tabs.md` §5).
 */

/** What a read compares with: `base`, since the branch left its base; `uncommitted`, the edits not committed yet. */
export const sessionChangesScopeSchema = z.enum(SESSION_CHANGES_SCOPES);

export type SessionChangesScopeValue = z.infer<typeof sessionChangesScopeSchema>;

/** `GET /sessions/{id}/changes?scope=`; `base` when absent. */
export const listSessionChangesQuerySchema = z.object({
  scope: sessionChangesScopeSchema.default('base'),
});

export type ListSessionChangesQueryDto = z.infer<typeof listSessionChangesQuerySchema>;

/** One changed file: its counts, and its unified diff when the host sent it. */
export const sessionChangedFileResponseSchema = z.object({
  path: z.string(),
  /** Where a renamed or copied file came from. */
  oldPath: z.string().nullable(),
  status: z.enum(SESSION_CHANGE_STATUSES),
  additions: z.number().int().min(0),
  deletions: z.number().int().min(0),
  binary: z.boolean(),
  /** The file's unified diff from its `diff --git` line; null when binary or left out. */
  patch: z.string().nullable(),
  /** The patch was left out: too long for one read, or not read in time. */
  patchOmitted: z.boolean(),
});

export type SessionChangedFileResponse = z.infer<typeof sessionChangedFileResponseSchema>;

/** One checkout's changes. */
export const sessionCheckoutChangesResponseSchema = z.object({
  /** `owner/name`. */
  repository: z.string(),
  checkoutId: z.string().uuid().nullable(),
  baseBranch: z.string().nullable(),
  /** The commit compared with; null when the branch has no commit yet. */
  base: z.string().nullable(),
  /** The branch's history did not reach its base yet, so its base's tip stood in. */
  approximate: z.boolean(),
  files: z.array(sessionChangedFileResponseSchema),
  /** Files past the bound of one read, counted and left out. */
  omittedFiles: z.number().int().min(0),
  additions: z.number().int().min(0),
  deletions: z.number().int().min(0),
});

export type SessionCheckoutChangesResponse = z.infer<typeof sessionCheckoutChangesResponseSchema>;

/** Whether the host answered: `host_offline` and `not_supported` come with no checkouts. */
export const sessionChangesStateSchema = z.enum(['listed', 'host_offline', 'not_supported']);

/** `GET /sessions/{id}/changes`. */
export const sessionChangesResponseSchema = z.object({
  state: sessionChangesStateSchema,
  scope: sessionChangesScopeSchema,
  checkouts: z.array(sessionCheckoutChangesResponseSchema),
});

export type SessionChangesResponse = z.infer<typeof sessionChangesResponseSchema>;
