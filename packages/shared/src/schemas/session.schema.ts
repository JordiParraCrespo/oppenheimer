import { z } from 'zod';
import { CODING_AGENT_IDS } from '../agents/catalog';

/**
 * Session shapes.
 *
 * A session is one piece of work inside a project: a terminal, an agent, and a
 * set of checkouts. A **checkout** is one repository checked out for one
 * session on its own branch, and a session has zero or more of them — zero is
 * a real session working in `sessions/<slug>/` with no git at all, which is
 * what a project of notes and documents needs
 * (`product/versions/mvp/10-api-modules-and-data-model.md`).
 *
 * Schemas state the constraint only, never a message (`.agents/rules/forms.md`).
 */

/** The agent a session launches. The catalog is the closed union; see `../agents/catalog`. */
export const codingAgentSchema = z.enum(CODING_AGENT_IDS);

/** GitHub's own numeric repository id — the picker is a live listing, so no row may exist yet. */
const githubRepoIdSchema = z.number().int().positive();

const sessionNameSchema = z.string().min(1).max(200);

/**
 * One repository, checked out for one session.
 *
 * `baseBranch` is what the session's branch is created *from*, defaulting to
 * the repository's default branch when absent. There is no branch field: the
 * working branch is always `oppenheimer/<project.slug>/<work_session.slug>`,
 * never the base itself — git refuses a worktree on a branch another worktree
 * already holds, so two sessions "on main" would fail at the second.
 *
 * The repository is named by an installation id plus GitHub's repository id
 * rather than `owner/repo`, which is ambiguous across two installations.
 */
export const sessionCheckoutInputSchema = z.object({
  installationId: z.string().uuid(),
  githubRepoId: githubRepoIdSchema,
  baseBranch: z.string().min(1).max(255).optional(),
});

export type SessionCheckoutInputDto = z.infer<typeof sessionCheckoutInputSchema>;

/**
 * `POST /sessions`, with an `Idempotency-Key` header so a retry after a lost
 * response returns the session already created instead of minting a second
 * directory and a second branch.
 *
 * `projectId` is optional because the MVP shows no project chip: absent, the
 * project is the one whose origin is the first checkout's repository, created
 * on the spot if this is the first session for it. `name` is optional and
 * usually absent — the first prompt names the session. `cwdGithubRepoId` picks
 * which checkout the agent is launched inside; absent with checkouts present,
 * it is the first, and absent with none it is the session directory itself.
 */
export const createSessionSchema = z.object({
  hostId: z.string().uuid(),
  agent: codingAgentSchema,
  projectId: z.string().uuid().optional(),
  name: sessionNameSchema.optional(),
  /** Zero or more. Empty is a session with no git at all, on purpose. */
  checkouts: z.array(sessionCheckoutInputSchema),
  cwdGithubRepoId: githubRepoIdSchema.optional(),
});

export type CreateSessionDto = z.infer<typeof createSessionSchema>;

/**
 * `POST /sessions/{id}/checkouts`. Adding a repository to a *running* session
 * is the shape Claude Code on the web already has; confining it to the create
 * screen would be a needless limit.
 */
export const addCheckoutSchema = sessionCheckoutInputSchema;

export type AddCheckoutDto = z.infer<typeof addCheckoutSchema>;

/** `PATCH /sessions/{id}`. Overwrites whatever the first prompt named the session. */
export const renameSessionSchema = z.object({
  name: sessionNameSchema,
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
 * The **derived group**, computed on read and never stored: what the sidebar
 * dot shows, organised by what needs you.
 *
 * `waiting-on-you` has four sources — the session failed, the agent has been
 * blocked for ≥ 30 s, a launch has sat in a non-ready state for ≥ 60 s, or the
 * pane is gone with no report. `landing` is the phase after the agent stops:
 * branch pushed, pull request open and approved, not yet merged.
 * `ready-for-review` versus `idle` is not a state at all but a hash
 * comparison — a report exists and `reportHash != ackedReportHash`.
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
