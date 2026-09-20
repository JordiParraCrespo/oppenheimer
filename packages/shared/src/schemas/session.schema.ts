import { z } from 'zod';
import { PAGINATION } from '../constants';
import { paginationSchema } from './pagination.schema';
import {
  codingAgentSchema,
  displayNameSchema,
  githubRepoIdSchema,
  gitRefSchema,
  installationIdSchema,
} from './primitives';

/**
 * Session shapes.
 *
 * A session is one piece of work inside a project: a terminal, an agent, and a
 * set of checkouts. A **checkout** is one repository checked out for one session
 * on its own branch, and a session has zero or more of them — zero is a real
 * session working in `sessions/<slug>/` with no git at all.
 *
 * This file is the fields the routes accept and the constraints that are
 * decidable from the body alone. It is deliberately not where the sessions
 * module's behaviour is written down.
 *
 * Schemas state the constraint only, never a message (`.agents/rules/forms.md`).
 */

export { codingAgentSchema };

/**
 * One repository, checked out for one session.
 *
 * `installationId` is **our row's UUID**, not GitHub's numeric installation id
 * (that one is `githubInstallationId`, on `connectInstallationSchema`).
 *
 * `baseBranch` is what the session's branch is created *from*, defaulting to the
 * repository's default branch when absent. There is no branch field: the working
 * branch is always `oppenheimer/<project.slug>/<work_session.slug>`, never the
 * base itself — git refuses a worktree on a branch another worktree already
 * holds, so two sessions "on main" would fail at the second.
 *
 * The repository is named by an installation id plus GitHub's repository id
 * rather than `owner/repo`, which is ambiguous across two installations.
 */
export const sessionCheckoutInputSchema = z.object({
  installationId: installationIdSchema,
  githubRepoId: githubRepoIdSchema,
  baseBranch: gitRefSchema.optional(),
});

export type SessionCheckoutInputDto = z.infer<typeof sessionCheckoutInputSchema>;

const createSessionFields = z.object({
  hostId: z.string().uuid(),
  agent: codingAgentSchema,
  projectId: z.string().uuid().optional(),
  name: displayNameSchema.optional(),
  /** Zero or more. Empty is a session with no git at all, on purpose. */
  checkouts: z.array(sessionCheckoutInputSchema),
  /** Which checkout the agent is launched inside. Must be one of `checkouts`. */
  cwdGithubRepoId: githubRepoIdSchema.optional(),
});

/**
 * `POST /sessions`, with an `Idempotency-Key` header so a retry after a lost
 * response returns the session already created instead of minting a second
 * directory and a second branch.
 *
 * The one cross-field rule that is decidable here is enforced here:
 * `cwdGithubRepoId`, when present, must name one of the posted checkouts. A cwd
 * pointing at a repository this session is not checking out is not a policy
 * question, it is an unsatisfiable body.
 */
export const createSessionSchema = createSessionFields
  .refine(
    (value) =>
      value.cwdGithubRepoId === undefined ||
      value.checkouts.some((checkout) => checkout.githubRepoId === value.cwdGithubRepoId),
    { path: ['cwdGithubRepoId'] },
  )
  /**
   * One checkout per repository. A directory name is never reused inside a session,
   * so the same repository twice is a body that cannot be satisfied — and refusing
   * it here is what keeps it a validation error rather than a unique violation
   * surfacing from the insert.
   */
  .refine(
    (value) =>
      new Set(value.checkouts.map((checkout) => checkout.githubRepoId)).size ===
      value.checkouts.length,
    { path: ['checkouts'] },
  );

export type CreateSessionDto = z.infer<typeof createSessionSchema>;

/**
 * `POST /sessions/{id}/checkouts`. Adding a repository to a *running* session is
 * the shape Claude Code on the web already has; confining it to the create
 * screen would be a needless limit.
 */
export const addCheckoutSchema = sessionCheckoutInputSchema;

export type AddCheckoutDto = z.infer<typeof addCheckoutSchema>;

/** `PATCH /sessions/{id}`. */
export const renameSessionSchema = z.object({
  name: displayNameSchema,
});

export type RenameSessionDto = z.infer<typeof renameSessionSchema>;

/**
 * The **stored lifecycle**, `work_session.state` — the fold of the append-only
 * event log, never a second truth.
 *
 * It is one of three vocabularies and the narrowest of them. The agent's own
 * observations (`working`, `blocked`, `idle`, `done`, `unknown`) are inputs
 * reported as events and never a session state: mapping `done` and `unknown`
 * onto this union was the error an earlier draft made.
 */
export const SESSION_STATES = ['starting', 'open', 'failed', 'resolved'] as const;

export const sessionStateSchema = z.enum(SESSION_STATES);

export type SessionState = z.infer<typeof sessionStateSchema>;

/**
 * The **derived group**, computed on read and never stored: what the sidebar dot
 * shows, organised by what needs you.
 *
 * `waiting-on-you` has four sources — the session failed, the agent has been
 * blocked for ≥ 30 s, a launch has sat in a non-ready state for ≥ 60 s, or the
 * pane is gone with no report. `landing` is the phase after the agent stops:
 * branch pushed, pull request open and approved, not yet merged.
 * `ready-for-review` versus `idle` is not a state at all but a hash comparison.
 */
export const SESSION_GROUPS = [
  'working',
  'waiting-on-you',
  'ready-for-review',
  'landing',
  'idle',
  'resolved',
] as const;

export const sessionGroupSchema = z.enum(SESSION_GROUPS);

export type SessionGroup = z.infer<typeof sessionGroupSchema>;

/**
 * A tmux window index — tabs are tmux windows, so an attach ticket authorises
 * one window.
 *
 * Written out rather than imported from `../protocol`, which the root barrel
 * deliberately does not re-export: pulling the wire vocabulary in here would put
 * it in every browser bundle that imports a session schema. Keep the two in
 * step; there is one number to keep.
 */
const sessionWindowSchema = z.number().int().min(0);

/**
 * `POST /sessions/{id}/attach-ticket`.
 *
 * A ticket authorises one window, so the window is what the body names; absent,
 * it is the first one, which is the only window a session has until somebody
 * opens a tab.
 */
export const issueAttachTicketSchema = z.object({
  window: sessionWindowSchema.optional(),
});

export type IssueAttachTicketDto = z.infer<typeof issueAttachTicketSchema>;

/**
 * `DELETE /sessions/{id}` — the close.
 *
 * Closing pushes each checkout's branch and then removes the worktrees, and it
 * **refuses when a checkout has unpushed work** unless the caller says the loss
 * is accepted. The flag is on the route rather than implied by a second endpoint
 * because the refusal is the default and accepting the loss has to be a
 * deliberate sentence somebody typed.
 *
 * Its reader is the **runner**: the request is recorded as
 * `session.close_requested` carrying this flag, and the host is what decides
 * whether a dirty worktree may go.
 */
export const closeSessionSchema = z.object({
  /**
   * The two literals, parsed as themselves. `z.coerce.boolean()` would apply
   * JavaScript truthiness to a query string, so `?acceptUnpushedWork=false` — a
   * caller saying no in the clearest way available — would arrive as `true` and
   * tell the runner it may throw away work.
   */
  acceptUnpushedWork: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export type CloseSessionDto = z.infer<typeof closeSessionSchema>;

/**
 * `GET /sessions`. The three filters the sidebar and the project screen need,
 * and nothing else: `state` is the **stored lifecycle**, not the derived group,
 * because a group is computed on read and cannot be an index.
 */
export const listSessionsQuerySchema = paginationSchema.extend({
  projectId: z.string().uuid().optional(),
  hostId: z.string().uuid().optional(),
  state: sessionStateSchema.optional(),
});

export type ListSessionsQueryDto = z.infer<typeof listSessionsQuerySchema>;

/**
 * `GET /sessions/{id}/events`, paginated by `seq` rather than by page.
 *
 * The log is append-only and `seq` is dense, so a cursor is both cheaper and
 * stable: a page number over a growing log re-reads rows it has already shown
 * the moment anything is appended.
 */
export const listSessionEventsQuerySchema = z.object({
  afterSeq: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
});

export type ListSessionEventsQueryDto = z.infer<typeof listSessionEventsQuerySchema>;
