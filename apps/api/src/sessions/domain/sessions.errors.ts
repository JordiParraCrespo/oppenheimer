import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
 * The sessions catalog.
 *
 * The prefix is plural because the Go runner owns `SESS_00x` in the same
 * `apps/docs/docs/errors.md` and a code may only be claimed once.
 *
 * Nothing here says whether a session exists in another workspace, and nothing
 * says which of a checkout's two ids was the one GitHub refused: both answers
 * would turn a refusal into a way of reading rows the caller cannot see.
 */
export const SessionErrors = {
  /**
   * Also raised for a session that exists but sits in another workspace: the
   * scoped read cannot see it, and distinguishing the two would confirm the id.
   */
  NOT_FOUND: {
    code: 'SESSIONS_001',
    message: 'Session not found',
    httpStatus: 404,
  },
  NO_ACTIVE_ORGANIZATION: {
    code: 'SESSIONS_002',
    message: 'Sessions belong to an organization',
    httpStatus: 400,
  },
  CHECKOUT_NOT_FOUND: {
    code: 'SESSIONS_003',
    message: 'Checkout not found on this session',
    httpStatus: 404,
  },
  /**
   * A repository this session already holds. The directory name inside a session
   * is never reused, so the second checkout of one repository is a request that
   * cannot be satisfied rather than one that silently overwrites the first.
   */
  CHECKOUT_ALREADY_PRESENT: {
    code: 'SESSIONS_004',
    message: 'That repository is already checked out for this session',
    httpStatus: 409,
  },
  /**
   * Raised on a stop, restart, rename or checkout change against a session that
   * has already been closed. Closing is final: the row stays for ever so its
   * directory name and branch are never reissued, which is exactly why it cannot
   * be reopened.
   */
  ALREADY_RESOLVED: {
    code: 'SESSIONS_005',
    message: 'That session is closed',
    httpStatus: 409,
  },
  /** The project a session was asked for is retired; its directory is out of use. */
  PROJECT_ARCHIVED: {
    code: 'SESSIONS_006',
    message: 'That project is archived',
    httpStatus: 409,
  },
  /**
   * Every directory name this repository can take inside this session is spent.
   * The three candidates are derived from the repository and a spent name is never
   * reissued, so the honest answer is a refusal: reusing one would put a fresh
   * agent in a retired agent's working directory.
   */
  CHECKOUT_NAMES_EXHAUSTED: {
    code: 'SESSIONS_007',
    message: 'That repository has used every directory name it can take here',
    httpStatus: 409,
  },
  /**
   * The attach ticket could not be claimed. A ticket is a single-use key in a
   * shared cache; a collision means the random id was already taken, which is a
   * server fault rather than a caller's.
   */
  ATTACH_TICKET_UNAVAILABLE: {
    code: 'SESSIONS_008',
    message: 'A terminal ticket could not be issued',
    httpStatus: 503,
  },
  /**
   * A session with no checkouts and no project named. Zero checkouts is a real
   * session — a project of notes and documents needs no git at all — but then
   * nothing says which project's directory it belongs in, and the project cannot
   * be derived from a repository that was not asked for.
   */
  PROJECT_REQUIRED: {
    code: 'SESSIONS_009',
    message: 'A session with no repositories must name its project',
    httpStatus: 400,
  },
  /**
   * A second repository on a session that has one. A runner makes one worktree
   * per session in the MVP, so a session is one repository (00); the create
   * body is capped by its schema, and this is the same rule for adding one
   * later, refused before a row is written rather than by the host (#56).
   */
  ONE_REPOSITORY: {
    code: 'SESSIONS_010',
    message: 'A session checks out one repository',
    httpStatus: 409,
  },
  /**
   * An agent the host's runner was built without. A runner probes the command of
   * every agent it can launch (`ProbedTools`), found or not, so an inventory with
   * no entry for this agent's command is a runner older than the agent, and it
   * would refuse `session.create`. Refused here, before a row is written, rather
   * than recorded and then failed by the host.
   */
  AGENT_UNSUPPORTED_BY_RUNNER: {
    code: 'SESSIONS_011',
    message: "This host's runner cannot start that agent",
    httpStatus: 409,
  },
} as const satisfies Record<string, ErrorDefinition>;
