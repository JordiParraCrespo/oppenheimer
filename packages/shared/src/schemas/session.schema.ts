import { z } from 'zod';
import { SESSION_EFFORTS, SESSION_PERMISSIONS } from '../agents/catalog.js';
import { PAGINATION } from '../constants/index.js';
import {
  attachedFilesAreValid,
  SESSION_CREATE_MAX_FILES,
  SESSION_FILE_MAX_BYTES,
  SESSION_FILE_MEDIA_TYPES,
  type SessionFileMediaType,
} from '../protocol/session-file.js';
import { paginationSchema } from './pagination.schema.js';
import {
  codingAgentSchema,
  displayNameSchema,
  githubRepoIdSchema,
  gitRefSchema,
  installationIdSchema,
  promptSchema,
} from './primitives.js';

/**
 * A session is one piece of work inside a project: a terminal, an agent, and a
 * set of checkouts. A **checkout** is one repository checked out for one session
 * on its own branch; the MVP takes exactly one (`checkouts` below).
 */

export { codingAgentSchema, SESSION_EFFORTS, SESSION_PERMISSIONS };

export const sessionPermissionSchema = z.enum(SESSION_PERMISSIONS);

export type SessionPermissionDto = z.infer<typeof sessionPermissionSchema>;

export const sessionEffortSchema = z.enum(SESSION_EFFORTS);

export type SessionEffortDto = z.infer<typeof sessionEffortSchema>;

/**
 * How the agent is started: the composer's foot row, as one object.
 *
 * The route body, the log payload, `session.create` and the response all carry
 * this same shape, so it is named once (`product/versions/mvp/03-control-plane.md`).
 *
 * `agent` is deliberately **not** in here. The agent is what the session is;
 * the launch is how it was started, and only the second is something a later
 * slice changes without making a different session.
 *
 * `permission` absent means `ask` for every agent that has approvals: a default
 * that escalates is the one mistake this field must not make, which is also why
 * the console never seeds `full` from a remembered choice. The default is
 * applied where the agent is known (the API's launch mapping), not here, because
 * an agent with no approvals — the blank terminal — records no level at all.
 *
 * What each value means to a given CLI is catalog data (`../agents/catalog`).
 */
export const sessionLaunchSchema = z.object({
  /** An id or alias the agent's own CLI takes; absent runs that agent's default. */
  model: z.string().min(1).max(128).optional(),
  /** Absent is `ask` for an agent with approvals, and nothing for one without. */
  permission: sessionPermissionSchema.optional(),
  /**
   * A level the session's model offers (`effortLevelFor`); any other name in
   * the union is recorded as none and never sent. Absent is the CLI's own default.
   */
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
 * branch is always `oppenheimer/<work_session.slug>`, never the
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
  /**
   * The project the session is listed under. Absent lists it in the workspace's
   * Unassigned project; a project is never derived from a repository.
   */
  projectId: z.string().uuid().optional(),
  name: displayNameSchema.optional(),
  /**
   * Exactly one in the MVP: a runner makes one worktree per session and
   * cannot launch one with no git, so a second repository, or none, is refused
   * here, before a row is written and the first prompt spent on a session no
   * host can make (#56, 00, 10).
   */
  checkouts: z.array(sessionCheckoutInputSchema).min(1).max(MAX_SESSION_CHECKOUTS),
  /** Which checkout the agent is launched inside. Must be one of `checkouts`. */
  cwdGithubRepoId: githubRepoIdSchema.optional(),
  /** The composer's foot row. Absent is `ask` with each agent's own defaults. */
  launch: sessionLaunchSchema.optional(),
  /**
   * The first task, as typed into the composer.
   *
   * It is recorded as the log's `prompt.first` and carried to the host on the
   * launch, so the agent starts with it — never a second message racing the
   * first. It also names the session where a namer is configured.
   */
  prompt: promptSchema.optional(),
  /**
   * Files attached to the first task (images, PDF, text), each uploaded beforehand with
   * `POST /sessions/attachments` and named here by the id that returned
   * (`product/versions/mvp/03-control-plane.md`). What becomes of them on the
   * wire is `session.create`'s `images`.
   */
  attachmentIds: z.array(z.string().uuid()).max(SESSION_CREATE_MAX_FILES).optional(),
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
  )
  /** The wire's own rule for `session.create`'s images: they ride a task, each once. */
  .refine((value) => attachedFilesAreValid(value.prompt, value.attachmentIds), {
    path: ['attachmentIds'],
  });

export type CreateSessionDto = z.infer<typeof createSessionSchema>;

/**
 * `POST /sessions/{id}/checkouts`. Adding a repository to a *running* session is
 * the shape Claude Code on the web already has; confining it to the create
 * screen would be a needless limit.
 */
export const addCheckoutSchema = sessionCheckoutInputSchema;

/**
 * Get a host ready for a session not yet asked for: the repositories it will
 * check out, cloned or fetched and a spare worktree made, so the create that
 * follows waits on neither. New session sends it as soon as a host and a
 * repository are picked. Nothing is recorded.
 */
export const prepareSessionSchema = z.object({
  hostId: z.string().uuid(),
  checkouts: z.array(sessionCheckoutInputSchema).min(1).max(MAX_SESSION_CHECKOUTS),
});

export type PrepareSessionInput = z.infer<typeof prepareSessionSchema>;

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
 * observations (`OBSERVED_AGENT_STATES` in `../protocol/primitives`) are inputs
 * reported as events, never a session state.
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
 * branch pushed, pull request open and approved, not yet merged. The pane-gone
 * source and `landing` have no writer yet (the API's `session-group.policy.ts`).
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
 * Written out rather than imported from `../protocol/primitives`, whose schema
 * objects are `zod/v4` and cannot be used from a classic `zod` schema (see
 * `./primitives`), and whose load registers JSON-Schema ids, a side effect no
 * browser bundle should carry. Keep the two in step; there is one number to keep.
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
 * `POST /sessions/{id}/images` — a file for a running session's prompt (the
 * route keeps its first name); these are the form fields beside it. A multipart
 * field arrives as text, so the window is coerced; absent, it is the agent's.
 */
export const pasteSessionImageSchema = z.object({
  window: z.coerce.number().int().min(0).optional(),
});

export type PasteSessionImageDto = z.infer<typeof pasteSessionImageSchema>;

/**
 * `POST /sessions/attachments` — a file for a session that does not exist
 * yet. The console uploads each file the composer holds when the task is sent,
 * then names them in `attachmentIds` on `POST /sessions`; an upload nobody
 * names expires on its own.
 */
export const sessionAttachmentSchema = z.object({
  id: z.string().uuid(),
  mediaType: z.enum(
    SESSION_FILE_MEDIA_TYPES as [SessionFileMediaType, ...SessionFileMediaType[]],
  ),
  size: z.number().int().min(1).max(SESSION_FILE_MAX_BYTES),
});

export type SessionAttachmentDto = z.infer<typeof sessionAttachmentSchema>;

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
 *
 * `cursor` is the previous page's `meta.nextCursor`, opaque, for the same
 * `sort`. With it the list is walked by key instead of by page: no count, and a
 * session is never returned twice in one walk however the list moves under it.
 * Without it, the list pages by `page`.
 */
export const listSessionsQuerySchema = paginationSchema.extend({
  projectId: z.string().uuid().optional(),
  hostId: z.string().uuid().optional(),
  state: sessionStateSchema.optional(),
  githubRepoId: z.coerce.number().int().positive().optional(),
  agent: codingAgentSchema.optional(),
  sort: sessionSortSchema.optional(),
  cursor: z.string().min(1).max(512).optional(),
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
