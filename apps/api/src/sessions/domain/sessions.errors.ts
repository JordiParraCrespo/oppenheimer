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
  /** An upload over `SESSION_IMAGE_MAX_BYTES`, refused by multer before it is buffered. */
  IMAGE_TOO_LARGE: {
    code: 'SESSIONS_012',
    message: 'That image is too large to give the session',
    httpStatus: 413,
  },
  /** Bytes that are none of the image types a session takes, whatever their label. */
  UNSUPPORTED_IMAGE: {
    code: 'SESSIONS_013',
    message: 'That is not an image the session can take',
    httpStatus: 415,
  },
  /**
   * Input for a session whose tmux session is gone. Whatever it was would be
   * sent to a window that is not there, so it is refused before it is sent.
   */
  NOT_RUNNING: {
    code: 'SESSIONS_014',
    message: 'That session is stopped',
    httpStatus: 409,
  },
  /** A multipart request with no file part: nothing to judge as an image. */
  IMAGE_MISSING: {
    code: 'SESSIONS_015',
    message: 'No image was attached',
    httpStatus: 400,
  },
  /**
   * The session's host holds no link right now. Input is not queued for a
   * host that comes back: the prompt it was meant for will have moved on.
   */
  HOST_OFFLINE: {
    code: 'SESSIONS_016',
    message: 'The session’s host is offline',
    httpStatus: 503,
  },
  /**
   * The host is linked but its runner did not say it takes this command: it
   * predates it, and updating the runner is what fixes it.
   */
  HOST_CANNOT_TAKE_IMAGES: {
    code: 'SESSIONS_017',
    message: 'The session’s host cannot take images until its runner is updated',
    httpStatus: 409,
  },
  /**
   * A session can only be moved to a project that holds every repository it has
   * checked out (`product/versions/mvp/12-projects.md`). Provisional, with the
   * rest of how sessions are organized; the detail names what is missing.
   */
  PROJECT_EXCLUDES_REPOSITORY: {
    code: 'SESSIONS_018',
    message: 'That project does not include this session’s repositories',
    httpStatus: 409,
  },
} as const satisfies Record<string, ErrorDefinition>;
