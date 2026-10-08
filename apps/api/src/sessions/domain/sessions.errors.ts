import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

/**
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
   * Raised on more work for a session that has already been closed: a stop,
   * restart, rename, move, added checkout, terminal ticket or input. Closing is
   * final: the row is a tombstone that keeps its directory name and branch from
   * being reissued.
   */
  ALREADY_RESOLVED: {
    code: 'SESSIONS_005',
    message: 'That session is closed',
    httpStatus: 409,
  },
  /** The project a session was asked for is retired: nothing new is listed under it. */
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
   * An agent the host's runner was built without (`runnerCanStart`). Refused
   * before a row is written, rather than recorded and then failed by the host.
   */
  AGENT_UNSUPPORTED_BY_RUNNER: {
    code: 'SESSIONS_011',
    message: "This host's runner cannot start that agent",
    httpStatus: 409,
  },
  /** An upload over `SESSION_FILE_MAX_BYTES`, refused by multer before it is buffered. */
  FILE_TOO_LARGE: {
    code: 'SESSIONS_012',
    message: 'That file is too large to give the session',
    httpStatus: 413,
  },
  /**
   * Bytes that are none of the types a session takes (the images, PDF, UTF-8
   * text that is not a script or markup), whatever their label or name.
   */
  UNSUPPORTED_FILE: {
    code: 'SESSIONS_013',
    message: 'That is not a file the session can take',
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
  /** A multipart request with no file part: nothing to judge. */
  FILE_MISSING: {
    code: 'SESSIONS_015',
    message: 'No file was attached',
    httpStatus: 400,
  },
  /**
   * The host holds no link right now: a paste into a session on it, or a
   * create carrying files for it. Neither is queued for a host that comes
   * back — the prompt moves on, and the files expire.
   */
  HOST_OFFLINE: {
    code: 'SESSIONS_016',
    message: 'The host is offline',
    httpStatus: 503,
  },
  /**
   * The host is linked but its runner did not say it takes this file — pasted
   * into a session or attached to a first task: no files at all
   * (`session.image`, `session.create.images`), or images only, not PDF or
   * text (`session.files`). It predates them, and updating the runner is
   * what fixes it.
   */
  HOST_CANNOT_TAKE_FILE: {
    code: 'SESSIONS_017',
    message: 'The host cannot take that file until its runner is updated',
    httpStatus: 409,
  },
  /**
   * A create names an attachment that is not waiting for this person: it
   * expired, it was already used, or it was never theirs. The three are one
   * answer, so an id cannot be probed.
   */
  ATTACHMENT_NOT_FOUND: {
    code: 'SESSIONS_019',
    message: 'An attached file is no longer waiting',
    httpStatus: 410,
  },
  /**
   * One person already has as many uploads waiting as they may. Each is up to
   * 5 MB in the cache that also backs sign-in, so the cap is on what is held.
   */
  TOO_MANY_ATTACHMENTS: {
    code: 'SESSIONS_020',
    message: 'Too many files are waiting to be sent',
    httpStatus: 429,
  },
  /**
   * A share link that opens nothing: never issued, revoked, expired, or its
   * session closed. One answer for all of them, so a holder learns nothing
   * from a link that no longer works, and the owner's list reports the same
   * for a link id that is not on this session.
   */
  SHARE_LINK_NOT_FOUND: {
    code: 'SESSIONS_021',
    message: 'That share link does not open anything',
    httpStatus: 404,
  },
  /** The link is for signed-in accounts, and nobody is signed in. */
  SHARE_LINK_SIGN_IN_REQUIRED: {
    code: 'SESSIONS_022',
    message: 'Sign in to open this share link',
    httpStatus: 401,
  },
  /** Signed in, and not one of the people the link names (or the email is unverified). */
  SHARE_LINK_NOT_INVITED: {
    code: 'SESSIONS_023',
    message: 'This share link is not shared with you',
    httpStatus: 403,
  },
  /** The session already holds `MAX_SHARE_LINKS_PER_SESSION` live links. */
  TOO_MANY_SHARE_LINKS: {
    code: 'SESSIONS_024',
    message: 'This session has as many share links as it can hold',
    httpStatus: 409,
  },
} as const satisfies Record<string, ErrorDefinition>;
