import { z } from 'zod';
import { SESSION_EFFORTS, SESSION_PERMISSIONS } from '../agents/catalog';
import { PAGINATION } from '../constants';
import { paginationSchema } from './pagination.schema';
import {
  codingAgentSchema,
  displayNameSchema,
  githubRepoIdSchema,
  gitRefSchema,
  installationIdSchema,
  promptSchema,
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

export { codingAgentSchema, SESSION_EFFORTS, SESSION_PERMISSIONS };

export const sessionPermissionSchema = z.enum(SESSION_PERMISSIONS);

export type SessionPermissionDto = z.infer<typeof sessionPermissionSchema>;

export const sessionEffortSchema = z.enum(SESSION_EFFORTS);

export type SessionEffortDto = z.infer<typeof sessionEffortSchema>;

/**
 * How the agent is started: the composer's foot row, as one object.
 *
 * Four controls that always travel together — the route body, the log payload,
 * `session.create` and the response all carry this same shape — so it is named
 * once rather than spelled four times in four places
 * (`product/versions/mvp/03-control-plane.md`).
 *
 * `agent` is deliberately **not** in here. The agent is what the session is;
 * the launch is how it was started, and only the second is something a later
 * slice changes without making a different session.
 *
 * `permission` absent means `ask` and nothing else, for every agent that has
 * approvals: it is the level that asks before every action, and a default that
 * escalates is the one mistake this field must not make. The console never
 * seeds `full` from a remembered choice either, for the same reason. The
 * default is applied where the agent is known (the API's launch mapping), not
 * here, because an agent with no approvals — the blank terminal — records no
 * level at all.
 *
 * What each value means to a given CLI is catalog data, beside that agent's
 * command (`../agents/catalog`), because the answer differs per agent and a
 * column here would state it once per agent.
 */
export const sessionLaunchSchema = z.object({
  /** An id or alias the agent's own CLI takes; absent runs that agent's default. */
  model: z.string().min(1).max(128).optional(),
  /** Absent is `ask` for an agent with approvals, and nothing for one without. */
  permission: sessionPermissionSchema.optional(),
  /** Absent leaves the agent's own default; an agent with no notion of it ignores it. */
  effort: sessionEffortSchema.optional(),
});

export type SessionLaunchDto = z.infer<typeof sessionLaunchSchema>;

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

/** How many repositories a session may check out: one, until runners make several. */
export const MAX_SESSION_CHECKOUTS = 1;

const createSessionFields = z.object({
  hostId: z.string().uuid(),
  agent: codingAgentSchema,
  /** Every session is listed under a project, and names it: none is derived. */
  projectId: z.string().uuid(),
  name: displayNameSchema.optional(),
  /**
   * At most one in the MVP: a runner makes one worktree per session, so a
   * second repository is refused here, before a row is written and the first
   * prompt spent on a session no host can make (#56, 00). Empty is a session
   * with no git at all, on purpose.
   */
  checkouts: z.array(sessionCheckoutInputSchema).max(MAX_SESSION_CHECKOUTS),
  /** Which checkout the agent is launched inside. Must be one of `checkouts`. */
  cwdGithubRepoId: githubRepoIdSchema.optional(),
  /** The composer's foot row. Absent is `ask` with each agent's own defaults. */
  launch: sessionLaunchSchema.optional(),
  /**
   * The first task, as typed into the composer.
   *
   * It is recorded as the log's `prompt.first` and carried to the host on the
   * launch, so the agent is started and then given it — never a second message
   * racing the first. It also names the session where a namer is configured.
   */
  prompt: promptSchema.optional(),
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
 * `POST /sessions/{id}/images` — the form fields beside the file. A multipart
 * field arrives as text, so the window is coerced; absent, it is the agent's.
 */
export const pasteSessionImageSchema = z.object({
  window: z.coerce.number().int().min(0).optional(),
});

export type PasteSessionImageDto = z.infer<typeof pasteSessionImageSchema>;

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
 * `POST /sessions/{id}/move`. Lists the session under another project. Nothing
 * moves on disk: a project is metadata, and a session's directory and branch
 * never name it (`product/versions/mvp/10-api-modules-and-data-model.md`).
 */
export const moveSessionSchema = z.object({
  projectId: z.string().uuid(),
});

export type MoveSessionDto = z.infer<typeof moveSessionSchema>;

/** The orders the session list can come back in. */
export const SESSION_SORTS = ['recent', 'oldest', 'name'] as const;

export const sessionSortSchema = z.enum(SESSION_SORTS);

export type SessionSortDto = z.infer<typeof sessionSortSchema>;

/**
 * `GET /sessions`. `state` is the **stored lifecycle**, not the derived group,
 * because a group is computed on read and cannot be an index.
 *
 * `githubRepoId`, `agent` and `sort` are the frames' sidebar filters, and
 * provisional with the rest of how sessions are organized (05): `recent` is last
 * activity first and is the default, `oldest` is creation order, `name` is
 * alphabetical.
 */
export const listSessionsQuerySchema = paginationSchema.extend({
  projectId: z.string().uuid().optional(),
  hostId: z.string().uuid().optional(),
  state: sessionStateSchema.optional(),
  githubRepoId: z.coerce.number().int().positive().optional(),
  agent: codingAgentSchema.optional(),
  sort: sessionSortSchema.optional(),
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
